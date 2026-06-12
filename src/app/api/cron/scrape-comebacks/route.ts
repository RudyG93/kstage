import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { scrapeComebacks } from '@/lib/scrapers/kpopofficial'
import { logScrapeRun } from '@/lib/scrapers/scrape-log'

// Vercel Cron déclenche en GET et ajoute l'en-tête Authorization: Bearer ${CRON_SECRET}.
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .select('id')
    .eq('type', 'kpopofficial')
    .maybeSingle()

  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 })
  if (!source)
    return NextResponse.json({ error: 'kpopofficial source not seeded' }, { status: 500 })

  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id, slug, name')

  if (groupsError) return NextResponse.json({ error: groupsError.message }, { status: 500 })

  // P0.3 observabilité (SCRAPING.md §6) : statut explicite + ligne scrape_log
  // par run, et 500 quand le run est inexploitable — Vercel ne marque un cron
  // en échec que sur non-2xx, et kpopofficial porte 100 % du futur de l'app.
  const startedAt = new Date().toISOString()
  try {
    const result = await scrapeComebacks(source, groups ?? [], supabase)
    const status = result.pagesFetched === 0 ? 'error' : result.parsed === 0 ? 'partial' : 'ok'
    const errorMsg =
      status === 'error'
        ? `0/${result.pagesTried} pages fetched: ${result.fetchErrors.join(' ; ')}`
        : status === 'partial'
          ? 'pages fetched but 0 entries parsed — markup change?'
          : null
    await logScrapeRun(supabase, {
      source: 'kpopofficial',
      status,
      startedAt,
      errorMsg,
      details: { ...result },
    })
    if (status === 'error') {
      return NextResponse.json({ ok: false, result }, { status: 500 })
    }
    return NextResponse.json({ ok: true, status, result })
  } catch (err) {
    await logScrapeRun(supabase, {
      source: 'kpopofficial',
      status: 'error',
      startedAt,
      errorMsg: String(err),
    })
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
