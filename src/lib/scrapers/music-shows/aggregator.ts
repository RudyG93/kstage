/**
 * Aggregator des scrapers music-shows : primary `live-show-updates` (carrd) +
 * fallbacks par broadcaster officiel.
 *
 * Stratégie :
 *   1. Tente la source primary. Récupère les shows couverts.
 *   2. Pour chaque fallback qui couvre un show MANQUANT ou MAIGRE
 *      (< MIN_LINEUP artistes — section carrd en cours d'édition ou périmée,
 *      R4-D 2026-07-13) du résultat primary, tente le fetch. Catch les
 *      erreurs réseau pour ne pas faire échouer l'aggrégation globale.
 *   3. Concatène et renvoie (un lineup fallback plus riche remplace le
 *      lineup maigre du même show/jour).
 *
 * → Tant que carrd marche, on consomme 1 fetch. Si le fan oublie un show,
 *   publie une section incomplète, ou que le carrd tombe, les broadcasters
 *   officiels prennent le relais.
 */

import { kstDayKey } from '@/lib/events/date'
import { kbsMusicBankSource } from './sources/kbs-music-bank'
import { liveShowUpdatesSource } from './sources/live-show-updates'
import { mbcMusicCoreSource } from './sources/mbc-music-core'
import { mnetMcountdownSource } from './sources/mnet-mcountdown'
import { sbsInkigayoSource } from './sources/sbs-inkigayo'
import { sbsTheShowSource } from './sources/sbs-the-show'
import { showChampionSource } from './sources/show-champion'
import type { ParsedLineup, ShowId, SourceScraper } from './types'

export const PRIMARY_SOURCE: SourceScraper = liveShowUpdatesSource
export const FALLBACK_SOURCES: SourceScraper[] = [
  kbsMusicBankSource,
  mnetMcountdownSource,
  mbcMusicCoreSource,
  sbsInkigayoSource,
  sbsTheShowSource,
  showChampionSource,
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

export async function aggregateLineups(
  now: Date = new Date(),
  // Sources injectables : les tests exercent la VRAIE logique avec des mocks
  // (le helper dupliqué du fichier de test avait déjà divergé — gap 2026-06-12).
  {
    primary = PRIMARY_SOURCE,
    fallbacks = FALLBACK_SOURCES,
  }: { primary?: SourceScraper; fallbacks?: SourceScraper[] } = {},
): Promise<AggregateResult> {
  const errors: { source: string; error: string }[] = []
  const fallbacksUsed: { source: string; show: ShowId }[] = []

  const primaryRes = await tryFetch(primary, now)
  let lineups: ParsedLineup[] = []
  let primaryOk = false
  if (primaryRes.ok) {
    primaryOk = true
    lineups = primaryRes.data
  } else {
    errors.push({ source: primary.label, error: primaryRes.error })
  }

  // Un show est BIEN couvert si au moins un de ses lineups a MIN_LINEUP
  // artistes — en dessous, c'est une section en cours d'édition (le carrd a
  // servi « inkigayo matched:0 » 4 jours de suite en juillet avec status ok) —
  // ET date d'aujourd'hui-KST ou plus tard : un lineup de la semaine PASSÉE
  // (le carrd traîne parfois) masquait le board broadcaster qui publie déjà
  // l'épisode suivant (Inkigayo 1318 invisible le 2026-07-17). L'épisode du
  // jour compte couvert : le run post-diffusion (22:00 KST) ne doit pas
  // déclencher les 6 fallbacks pour rien.
  const MIN_LINEUP = 3
  const todayKey = kstDayKey(now.toISOString())
  const wellCovered = (show: ShowId) =>
    lineups.some(
      (l) =>
        l.show === show && l.artistsRaw.length >= MIN_LINEUP && kstDayKey(l.startAtIso) >= todayKey,
    )

  for (const fb of fallbacks) {
    const missing = fb.shows.filter((s) => !wellCovered(s))
    if (missing.length === 0) continue
    const fbRes = await tryFetch(fb, now)
    if (!fbRes.ok) {
      errors.push({ source: fb.label, error: fbRes.error })
      continue
    }
    for (const l of fbRes.data) {
      if (wellCovered(l.show)) continue
      // Même show + même jour : le lineup fallback plus riche REMPLACE le
      // lineup maigre (sinon doublon d'épisode) ; sinon il s'ajoute.
      const sameDay = lineups.findIndex(
        (c) => c.show === l.show && c.startAtIso.slice(0, 10) === l.startAtIso.slice(0, 10),
      )
      if (sameDay >= 0) {
        if (l.artistsRaw.length <= lineups[sameDay].artistsRaw.length) continue
        lineups[sameDay] = l
      } else {
        lineups.push(l)
      }
      fallbacksUsed.push({ source: fb.label, show: l.show })
    }
  }

  return { lineups, primaryOk, fallbacksUsed, errors }
}
