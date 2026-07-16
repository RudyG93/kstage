// Lecture de la santé des sources pour la carte /admin (Lot 5). scrape_log est
// deny-all RLS → service role après contrôle isAdmin (pattern debuts/actions.ts).

import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { evaluateSourceHealth, type SourceCheck } from '@/lib/monitoring/health'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return !!user && isAdmin(user.email)
}

/** Même fenêtre/évaluation que /api/cron/monitor — la carte admin montre ce que
 * le monitor verrait à l'instant T. Null si non-admin ou lecture impossible. */
export async function getSourceHealth(): Promise<{
  checks: SourceCheck[]
  alerts: string[]
} | null> {
  if (!(await requireAdmin())) return null
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await serviceClient()
    .from('scrape_log')
    .select('source, status, started_at, details')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(500)
  if (error) return null
  return evaluateSourceHealth(data ?? [], new Date())
}
