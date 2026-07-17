/**
 * Fallback scraper MBC M Show Champion — page programme officielle imbc.
 *
 * Même domaine `m.imbc.com` que notre fallback Music Core mais structure de
 * page différente : liste antéchronologique des derniers épisodes diffusés,
 * chacun sous forme `*   [![Image N: ...](IMG_URL) **NNN**회 Show Champion
 * (쇼 챔피언) - HEADLINERS 등 [FULL_LIST] YYYY.MM.DD](VOD_URL)`.
 *
 * Stratégie :
 *   1. Repère la 1ʳᵉ ligne contenant `**NNN**회 Show Champion` (= plus récent).
 *   2. Ancrage important : `Show Champion (쇼 챔피언)` apparaît AUSSI dans
 *      l'alt-text de l'image en début de ligne, donc on ancre sur `**NNN**회`
 *      pour viser le titre réel.
 *   3. Splitte le titre sur `등` (etc.). Si du texte suit `등` avant la date
 *      → c'est la liste complète (en coréen, parfois doublée En+Ko comme Ep
 *      597). Sinon fallback sur les headliners avant `등`.
 *
 * Heure : Wednesday 17:00 KST (fixe, cf. SHOW_DESCRIPTORS).
 *
 * ⚠️ Pas forward-looking — la page liste les épisodes passés. Le primary
 * carrd reste la source forward-looking. Ce fallback couvre la redondance
 * si carrd tombe + l'historique récent. L'idempotence (unique constraint
 * sur events) protège contre les re-inserts.
 */

import { kstDateTimeToIso, nextWeeklySlotIso } from '../slots'
import type { ParsedLineup, SourceScraper } from '../types'
import { fetchViaJina } from '../jina-fetch'

export const SOURCE_URL = 'https://m.imbc.com/program/1003864100000100000'
const SOURCE_LABEL = 'show-champion'

export interface ParsedShowChampion {
  artistsRaw: string[]
  episodeNumber: number | null
  broadcastDate: { year: number; month: number; day: number } | null
}

/**
 * Pure : extrait le lineup le plus récent depuis le markdown brut imbc.
 *
 * Renvoie null si aucun épisode reconnaissable. Si la 1ʳᵉ entrée ne porte
 * que les headliners (cas Ep 596 du fixture), on retombe sur ceux-là.
 */
export function parseShowChampion(markdown: string): ParsedShowChampion | null {
  const lines = markdown.split('\n')

  for (const line of lines) {
    const anchor = line.match(/\*\*(\d+)\*\*회\s+Show Champion\s*\([^)]+\)\s*-?\s*/u)
    if (!anchor || anchor.index === undefined) continue

    const episodeNumber = Number(anchor[1])
    let body = line.slice(anchor.index + anchor[0].length)

    // Strip le `](URL)` de fermeture du markdown link englobant la ligne.
    const closeIdx = body.search(/\]\(https?:[^)]+\)\s*$/)
    if (closeIdx !== -1) body = body.slice(0, closeIdx)

    // Cherche la dernière date `YYYY.MM.DD` du body (l'URL d'image en début
    // de ligne contient des chemins du type `/20265/...` qui ne matchent pas
    // ce pattern, donc safe).
    const dateMatches = [...body.matchAll(/(\d{4})\.(\d{1,2})\.(\d{1,2})/g)]
    let broadcastDate: { year: number; month: number; day: number } | null = null
    if (dateMatches.length > 0) {
      const last = dateMatches[dateMatches.length - 1]
      broadcastDate = {
        year: Number(last[1]),
        month: Number(last[2]),
        day: Number(last[3]),
      }
      // On retire la date (et tout ce qui suit) du body pour isoler le titre.
      if (last.index !== undefined) body = body.slice(0, last.index)
    }
    body = body.trim()

    // Splitte sur 등 (etc.).
    const deungIdx = body.indexOf('등')
    let raw: string
    if (deungIdx !== -1) {
      const after = body.slice(deungIdx + 1).trim()
      raw = after.length > 0 ? after : body.slice(0, deungIdx).trim()
    } else {
      raw = body
    }

    const artistsRaw = raw
      .split(/\s*,\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    if (artistsRaw.length === 0) continue

    return { artistsRaw, episodeNumber, broadcastDate }
  }

  return null
}

export async function fetchShowChampion(now: Date = new Date()): Promise<ParsedLineup[]> {
  const markdown = await fetchViaJina(SOURCE_URL)
  const parsed = parseShowChampion(markdown)
  if (!parsed) return []

  let startAtIso: string | null = null
  if (parsed.broadcastDate) {
    startAtIso = kstDateTimeToIso(
      parsed.broadcastDate.year,
      parsed.broadcastDate.month,
      parsed.broadcastDate.day,
      17,
      0,
    )
  }
  if (!startAtIso) {
    startAtIso = nextWeeklySlotIso('show-champion', now)
  }

  return [
    {
      show: 'show-champion',
      episodeNumber: parsed.episodeNumber,
      startAtIso,
      isHighlight: false,
      artistsRaw: parsed.artistsRaw,
      sourceLabel: SOURCE_LABEL,
    },
  ]
}

export const showChampionSource: SourceScraper = {
  label: SOURCE_LABEL,
  sourceUrl: SOURCE_URL,
  shows: ['show-champion'],
  fetch: fetchShowChampion,
}
