import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { scrapeGroup, QuotaExceededError } from '@/lib/scrapers/youtube'
import { logScrapeRun } from '@/lib/scrapers/scrape-log'

// P0.5 : la couverture est passée de 8 à ~90 sources. En séquentiel (~1-2 s/
// source) le run dépasserait le timeout fonction → les dernières sources ne
// seraient jamais scrapées. On scrape par lots concurrents (CONCURRENCY) pour
// tenir le wall-clock sans latence de rotation, et on relève maxDuration.
export const maxDuration = 300
const CONCURRENCY = 6

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

  const apiKey = process.env.YOUTUBE_API_KEY!
  if (!apiKey) return NextResponse.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 500 })

  const { data: sources, error } = await supabase
    .from('sources')
    .select('id, url, group_id')
    .eq('type', 'youtube_api')
    .not('group_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const startedAt = new Date().toISOString()
  const results: Record<
    string,
    { inserted: number; skipped: number; premieres: number; units: number } | { error: string }
  > = {}

  // P0.4 : le quota YouTube est global au projet — au premier 403 quotaExceeded,
  // inutile de lancer d'autres sources, on arrête après le lot en cours.
  let quotaExhausted = false
  const sourceList = sources ?? []
  for (let i = 0; i < sourceList.length && !quotaExhausted; i += CONCURRENCY) {
    const batch = sourceList.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(
      batch.map((source) =>
        scrapeGroup(source as { id: string; url: string; group_id: string }, apiKey, supabase),
      ),
    )
    settled.forEach((res, j) => {
      const source = batch[j]
      if (res.status === 'fulfilled') {
        results[source.id] = res.value
      } else {
        results[source.id] = { error: String(res.reason) }
        if (res.reason instanceof QuotaExceededError) quotaExhausted = true
      }
    })
  }

  // P0.3 observabilité (SCRAPING.md §6) : avant, la route renvoyait 200
  // {ok:true} même avec les 8 sources en échec — invisible pour le dashboard
  // Vercel Crons (qui ne signale que les non-2xx) et pour scrape_log (0 ligne).
  const sourceIds = Object.keys(results)
  const failed = sourceIds.filter((id) => 'error' in results[id])
  const totalUnits = Object.values(results).reduce(
    (sum, r) => sum + ('units' in r ? r.units : 0),
    0,
  )
  const status =
    sourceIds.length === 0 || failed.length === sourceIds.length
      ? 'error'
      : failed.length > 0
        ? 'partial'
        : 'ok'
  await logScrapeRun(supabase, {
    source: 'youtube',
    status,
    startedAt,
    errorMsg:
      status === 'ok'
        ? null
        : sourceIds.length === 0
          ? 'no youtube_api sources seeded'
          : quotaExhausted
            ? `quota exceeded after ${sourceIds.length}/${(sources ?? []).length} sources`
            : `${failed.length}/${sourceIds.length} sources failed`,
    details: { results, totalUnits, quotaExhausted },
  })
  if (status === 'error') {
    return NextResponse.json({ ok: false, results }, { status: 500 })
  }
  return NextResponse.json({ ok: true, status, results })
}
