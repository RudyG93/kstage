import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { scrapeGroup, resolveChannelsBatch, QuotaExceededError } from '@/lib/scrapers/youtube'
import type { ChannelMeta } from '@/lib/scrapers/youtube'
import { logScrapeRun } from '@/lib/scrapers/scrape-log'

// P0.5 : la couverture est passée de 8 à ~90 sources. En séquentiel (~1-2 s/
// source) le run dépasserait le timeout fonction → les dernières sources ne
// seraient jamais scrapées. On scrape par lots concurrents (CONCURRENCY) pour
// tenir le wall-clock sans latence de rotation, et on relève maxDuration.
export const maxDuration = 300
const CONCURRENCY = 6
// Rotation de re-scan PROFOND (0062, round 2026-07-18) : chaque run re-pagine
// à fond les N sources les plus anciennement deep-scannées (cycle ~hebdo sur
// ~120 sources) — les MVs anciens / trous d'historique ne restent plus
// invisibles. Coût : ~DEEP_MAX_PAGES units × DEEP_PER_RUN ≈ 300/jour.
const DEEP_PER_RUN = 15
const DEEP_MAX_PAGES = 20

// Vercel Cron déclenche en GET et ajoute l'en-tête Authorization: Bearer ${CRON_SECRET}.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
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
    .select('id, url, group_id, last_deep_scan_at, channel_id')
    .eq('type', 'youtube_api')
    .not('group_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Résolution GROUPÉE des chaînes, avant tout scrape : `channels.list` coûte
  // 1 unit par appel et accepte 50 ids. Les 355 sources ne pointent que 280
  // chaînes distinctes — 6 appels au lieu de 351, soit un quart du run.
  // Une chaîne absente du lot laisse `opts.channel` vide : `scrapeGroup`
  // retombe alors sur la résolution unitaire, qui JETTE si la chaîne n'existe
  // plus. C'est cette exception qui empêche `last_scraped_at` d'être posé et
  // qui fait remonter la source dans le check `stale_sources` — un repli
  // silencieux rendrait une chaîne morte invisible pour toujours.
  // Un lot en échec ne doit pas condamner le run : on repart sur la résolution
  // unitaire, plus chère mais qui porte déjà toutes les gardes (QuotaExceeded
  // arrête proprement, chaîne introuvable fait échouer SA source).
  const lot = await resolveChannelsBatch(
    (sources ?? []).map((s) => s.channel_id).filter((id): id is string => !!id),
    apiKey,
  ).catch((e) => {
    console.error(`scrape-youtube: lot de résolution en échec, repli unitaire — ${String(e)}`)
    return { channels: new Map<string, ChannelMeta>(), units: 0 }
  })
  const unitsPrescan = lot.units

  // Sélection deep du run : jamais scannées d'abord (null), puis plus anciennes.
  const deepIds = new Set(
    [...(sources ?? [])]
      .sort((a, b) => (a.last_deep_scan_at ?? '').localeCompare(b.last_deep_scan_at ?? ''))
      .slice(0, DEEP_PER_RUN)
      .map((s) => s.id),
  )

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
        scrapeGroup(source as { id: string; url: string; group_id: string }, apiKey, supabase, {
          ...(deepIds.has(source.id) ? { maxPages: DEEP_MAX_PAGES } : {}),
          ...(source.channel_id && lot.channels.has(source.channel_id)
            ? { channel: lot.channels.get(source.channel_id)! }
            : {}),
        }),
      ),
    )
    const deepDone: string[] = []
    settled.forEach((res, j) => {
      const source = batch[j]
      if (res.status === 'fulfilled') {
        results[source.id] = res.value
        if (deepIds.has(source.id)) deepDone.push(source.id)
      } else {
        results[source.id] = { error: String(res.reason) }
        if (res.reason instanceof QuotaExceededError) quotaExhausted = true
      }
    })
    // Stamp APRÈS succès seulement : un deep-scan raté repassera en tête.
    if (deepDone.length > 0) {
      await supabase
        .from('sources')
        .update({ last_deep_scan_at: new Date().toISOString() })
        .in('id', deepDone)
    }
  }

  // P0.3 observabilité (SCRAPING.md §6) : avant, la route renvoyait 200
  // {ok:true} même avec les 8 sources en échec — invisible pour le dashboard
  // Vercel Crons (qui ne signale que les non-2xx) et pour scrape_log (0 ligne).
  const sourceIds = Object.keys(results)
  const failed = sourceIds.filter((id) => 'error' in results[id])
  // Les units du lot de résolution comptent dans le total : sans elles, le
  // journal sous-estimerait le coût réel du run.
  const totalUnits =
    unitsPrescan + Object.values(results).reduce((sum, r) => sum + ('units' in r ? r.units : 0), 0)
  // Seuil de tolérance (nuit 2026-08-21) : UNE source cassée sur 326 mettait le
  // run en `partial` à chaque exécution depuis des jours (playlist uploads
  // introuvable côté TOZ). Résultat : le statut criait au loup en permanence,
  // donc plus personne ne le lisait. La santé d'une source ISOLÉE est déjà
  // suivie par le check `stale_sources` du data-health ; le statut du run, lui,
  // doit signaler une panne du RUN. Le détail des échecs reste dans `details`.
  const failureRatio = sourceIds.length > 0 ? failed.length / sourceIds.length : 1
  const significantFailure = failed.length >= 5 || failureRatio > 0.05
  const status =
    sourceIds.length === 0 || failed.length === sourceIds.length
      ? 'error'
      : significantFailure || quotaExhausted
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
    details: { results, totalUnits, quotaExhausted, failedSources: failed },
  })
  if (status === 'error') {
    return NextResponse.json({ ok: false, results }, { status: 500 })
  }
  return NextResponse.json({ ok: true, status, results })
}
