/**
 * Aggregator des scrapers music-shows : primary `live-show-updates` (carrd) +
 * fallbacks par broadcaster officiel.
 *
 * Stratégie :
 *   1. Tente la source primary. Récupère les shows couverts.
 *   2. Pour chaque fallback qui couvre un show MANQUANT du résultat primary,
 *      tente le fetch. Catch les erreurs réseau pour ne pas faire échouer
 *      l'aggrégation globale.
 *   3. Concatène et renvoie.
 *
 * → Tant que carrd marche, on consomme 1 fetch. Si le fan oublie un show ou
 *   que le carrd tombe, les broadcasters officiels prennent le relais.
 */

import { kbsMusicBankSource } from './sources/kbs-music-bank'
import { liveShowUpdatesSource } from './sources/live-show-updates'
import { mbcMusicCoreSource } from './sources/mbc-music-core'
import { mnetMcountdownSource } from './sources/mnet-mcountdown'
import type { ParsedLineup, ShowId, SourceScraper } from './types'

export const PRIMARY_SOURCE: SourceScraper = liveShowUpdatesSource
export const FALLBACK_SOURCES: SourceScraper[] = [
  kbsMusicBankSource,
  mnetMcountdownSource,
  mbcMusicCoreSource,
]

export interface AggregateResult {
  lineups: ParsedLineup[]
  primaryOk: boolean
  fallbacksUsed: { source: string; show: ShowId }[]
  errors: { source: string; error: string }[]
}

async function tryFetch(
  source: SourceScraper,
  now: Date,
): Promise<{ ok: true; data: ParsedLineup[] } | { ok: false; error: string }> {
  try {
    const data = await source.fetch(now)
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function aggregateLineups(now: Date = new Date()): Promise<AggregateResult> {
  const errors: { source: string; error: string }[] = []
  const fallbacksUsed: { source: string; show: ShowId }[] = []

  const primaryRes = await tryFetch(PRIMARY_SOURCE, now)
  let lineups: ParsedLineup[] = []
  let primaryOk = false
  if (primaryRes.ok) {
    primaryOk = true
    lineups = primaryRes.data
  } else {
    errors.push({ source: PRIMARY_SOURCE.label, error: primaryRes.error })
  }

  const covered = new Set<ShowId>(lineups.map((l) => l.show))

  for (const fb of FALLBACK_SOURCES) {
    // Le fallback ne sert que s'il fournit au moins un show non-encore couvert.
    const missing = fb.shows.filter((s) => !covered.has(s))
    if (missing.length === 0) continue
    const fbRes = await tryFetch(fb, now)
    if (!fbRes.ok) {
      errors.push({ source: fb.label, error: fbRes.error })
      continue
    }
    for (const l of fbRes.data) {
      if (covered.has(l.show)) continue
      lineups.push(l)
      covered.add(l.show)
      fallbacksUsed.push({ source: fb.label, show: l.show })
    }
  }

  return { lineups, primaryOk, fallbacksUsed, errors }
}
