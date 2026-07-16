import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { evaluateSourceHealth } from '@/lib/monitoring/health'
import type { Database } from '@/types/database'

// Monitoring actif (Phase 1 Lot 5, audit §6.3) : lit scrape_log et évalue le
// contrat d'alerte (partial ×2 consécutifs, music show J-1 sans données,
// source critique périmée 2 cycles). Alerte → 500 → le step curl de crons.yml
// exit 1 → run GitHub Actions rouge → email natif. Un `partial` isolé restait
// invisible jusqu'ici (HTTP 200, run vert) — c'est le trou que cette route
// ferme. L'échec de la route elle-même (scrape_log illisible) → 500 aussi.

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // 7 jours suffisent aux 3 règles (la plus large regarde 2 × 24 h) ; limit
  // large — ~10 runs/jour toutes sources confondues aujourd'hui.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('scrape_log')
    .select('source, status, started_at, details')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const { checks, alerts } = evaluateSourceHealth(data ?? [], new Date())
  if (alerts.length > 0) {
    return NextResponse.json({ ok: false, alerts, checks }, { status: 500 })
  }
  return NextResponse.json({ ok: true, checks })
}
