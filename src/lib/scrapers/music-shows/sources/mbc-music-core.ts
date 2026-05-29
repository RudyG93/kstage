/**
 * Fallback scraper MBC Music Core — page officielle imbc PreView.
 *
 * Format observé (fixture 2026-05-29) :
 *   - Lineup principal (italique gras) :
 *       _artist1 . artist2 . artist3 ._  (séparateur = " . " avec espaces)
 *   - Episode + date dans la liste des épisodes :
 *       `[NNN회]YYYY-MM-DD`
 *   - Heure de diffusion : Saturday 15:15 KST (fixe, pas dans le HTML).
 *
 * Stratégie : (1) trouver le lineup italique pour l'épisode courant, (2)
 * matcher `[NNN회]YYYY-MM-DD` pour épisode + date.
 */

import { kstDateTimeToIso, nextWeeklySlotIso } from '../slots'
import type { ParsedLineup, SourceScraper } from '../types'

export const SOURCE_URL = 'https://playvod.imbc.com/Templete/PreView?bid=1000788100000100000'
const SOURCE_LABEL = 'mbc-music-core'
const JINA_URL = `https://r.jina.ai/${SOURCE_URL}`

export interface ParsedImbcMusicCore {
  artistsRaw: string[]
  episodeNumber: number | null
  broadcastDate: { year: number; month: number; day: number } | null
}

/** Pure : extrait le lineup courant depuis le markdown brut imbc. */
export function parseMbcMusicCore(markdown: string): ParsedImbcMusicCore | null {
  // 1) Lineup : ligne italique gras `**_artist1 . artist2 ._**` ou
  //    seulement les `_..._` (selon styling Markdown rendu par Jina).
  //    On accepte les deux et on prend la 1ʳᵉ occurrence qui contient
  //    au moins 5 séparateurs " . ".
  let lineupBody: string | null = null
  // Cherche un bloc emphase + au moins 5 " . " (sépare au moins 6 artistes).
  const emphasisMatches = markdown.matchAll(/\*\*_([^_]+)_\*\*/g)
  for (const m of emphasisMatches) {
    const body = m[1]
    const sepCount = (body.match(/\s\.\s/g) ?? []).length
    if (sepCount >= 5) {
      lineupBody = body
      break
    }
  }
  // Fallback : juste `_..._` non gras.
  if (!lineupBody) {
    const italicMatches = markdown.matchAll(/_([^_]+)_/g)
    for (const m of italicMatches) {
      const body = m[1]
      const sepCount = (body.match(/\s\.\s/g) ?? []).length
      if (sepCount >= 5) {
        lineupBody = body
        break
      }
    }
  }
  if (!lineupBody) return null

  const artistsRaw = lineupBody
    .split(/\s\.\s/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (artistsRaw.length === 0) return null

  // 2) Episode + date : `[948회]2026-05-30` — prend le premier match.
  let episodeNumber: number | null = null
  let broadcastDate: { year: number; month: number; day: number } | null = null
  const epMatch = markdown.match(/\[(\d+)회\]\s*(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (epMatch) {
    episodeNumber = Number(epMatch[1])
    broadcastDate = {
      year: Number(epMatch[2]),
      month: Number(epMatch[3]),
      day: Number(epMatch[4]),
    }
  }

  return { artistsRaw, episodeNumber, broadcastDate }
}

export async function fetchMbcMusicCore(now: Date = new Date()): Promise<ParsedLineup[]> {
  const res = await fetch(JINA_URL, {
    headers: { 'user-agent': 'KStageBot/0.1 (+https://kstage.vercel.app)' },
  })
  if (!res.ok) throw new Error(`imbc Music Core fetch failed: HTTP ${res.status}`)
  const markdown = await res.text()
  const parsed = parseMbcMusicCore(markdown)
  if (!parsed) return []

  let startAtIso: string | null = null
  if (parsed.broadcastDate) {
    startAtIso = kstDateTimeToIso(
      parsed.broadcastDate.year,
      parsed.broadcastDate.month,
      parsed.broadcastDate.day,
      15,
      15,
    )
  }
  if (!startAtIso) {
    startAtIso = nextWeeklySlotIso('music-core', now)
  }

  return [
    {
      show: 'music-core',
      episodeNumber: parsed.episodeNumber,
      startAtIso,
      isHighlight: false,
      artistsRaw: parsed.artistsRaw,
      sourceLabel: SOURCE_LABEL,
    },
  ]
}

export const mbcMusicCoreSource: SourceScraper = {
  label: SOURCE_LABEL,
  shows: ['music-core'],
  fetch: fetchMbcMusicCore,
}
