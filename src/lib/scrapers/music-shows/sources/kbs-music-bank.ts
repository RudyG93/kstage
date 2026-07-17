/**
 * Fallback scraper KBS Music Bank — page officielle KBS, accessible via Jina.
 *
 * Format observé (fixture 2026-05-29) :
 *   - Marker lineup principal : `<<뮤직뱅크 X월 Y일 출연자>>{artist1}, {artist2}, …`
 *   - Date du jour : `오늘 방송 YYYY.MM.DD`
 *   - Heure de diffusion : `2TV 금 17:00 방송` (fixe vendredi 17:00 KST)
 *
 * Le numéro d'épisode courant n'est pas exposé de façon fiable (les archives
 * mentionnent `NNNN회 YYYY.MM.DD` pour les épisodes passés mais pas le courant).
 */

import { kstDateTimeToIso } from '../slots'
import type { ParsedLineup, SourceScraper } from '../types'
import { fetchViaJina } from '../jina-fetch'

export const SOURCE_URL = 'https://program.kbs.co.kr/2tv/enter/musicbank/pc/index.html'
const SOURCE_LABEL = 'kbs-music-bank'

/** Pure : extrait le lineup depuis le markdown brut. */
export function parseKbsMusicBank(markdown: string): {
  artistsRaw: string[]
  broadcastDate: { year: number; month: number; day: number } | null
} | null {
  // 1) Lineup : `<<뮤직뱅크 X월 Y일 출연자>>artist1, artist2, …`
  //    On capture jusqu'à la prochaine balise markdown `![Image` ou fin de ligne.
  const lineupMatch = markdown.match(
    /<<뮤직뱅크\s*\d+월\s*\d+일\s*출연자>>([^\n!]+?)(?:!\[Image|\n|$)/,
  )
  if (!lineupMatch) return null

  // Strip `(feat. …)` / `(ft. …)` AVANT le split sur "," : la virgule interne
  // au feat. ("(feat. TARZZAN, WOOCHAN)") fausserait le découpage des artistes.
  const cleaned = lineupMatch[1].replace(/\s*\(\s*(?:feat\.?|ft\.?)[^)]*\)/gi, '')
  const artistsRaw = cleaned
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (artistsRaw.length === 0) return null

  // 2) Date : `오늘 방송 YYYY.MM.DD`
  let broadcastDate: { year: number; month: number; day: number } | null = null
  const dateMatch = markdown.match(/오늘\s*방송\s*(\d{4})\.(\d{1,2})\.(\d{1,2})/)
  if (dateMatch) {
    broadcastDate = {
      year: Number(dateMatch[1]),
      month: Number(dateMatch[2]),
      day: Number(dateMatch[3]),
    }
  }

  return { artistsRaw, broadcastDate }
}

/**
 * Fetch + parse. Renvoie un `ParsedLineup` unique (ou [] si pas de lineup).
 * Si la date n'est pas extraite, fallback sur "prochain vendredi 17:00 KST"
 * via le helper slots.
 */
export async function fetchKbsMusicBank(now: Date = new Date()): Promise<ParsedLineup[]> {
  const markdown = await fetchViaJina(SOURCE_URL)

  const parsed = parseKbsMusicBank(markdown)
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
    // Fallback : créneau hebdo officiel.
    const { nextWeeklySlotIso } = await import('../slots')
    startAtIso = nextWeeklySlotIso('music-bank', now)
  }

  return [
    {
      show: 'music-bank',
      episodeNumber: null,
      startAtIso,
      isHighlight: false,
      artistsRaw: parsed.artistsRaw,
      sourceLabel: SOURCE_LABEL,
    },
  ]
}

export const kbsMusicBankSource: SourceScraper = {
  label: SOURCE_LABEL,
  sourceUrl: SOURCE_URL,
  shows: ['music-bank'],
  fetch: fetchKbsMusicBank,
}
