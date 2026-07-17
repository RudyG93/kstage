/**
 * Fallback scraper SBS Inkigayo — 2-level scrape via board.
 *
 *   1. Board `programs.sbs.co.kr/enter/gayo/boards/54772` → URL du post le
 *      plus récent (ex `board_no=151356` pour Ep 1312).
 *   2. Post → extrait `# NNNN 회 인기가요 출연자 #` marker + ligne suivante
 *      avec lineup comma-separated.
 *
 * Heure : Sunday 15:25 KST (fixe, cf. types.ts).
 */

import { kstDateTimeToIso, nextWeeklySlotIso } from '../slots'
import type { ParsedLineup, SourceScraper } from '../types'
import { fetchSbsBoardLatestPost, resolveBroadcastYear } from './sbs-board'

export const BOARD_URL = 'https://programs.sbs.co.kr/enter/gayo/boards/54772'
const SOURCE_LABEL = 'sbs-inkigayo'

const LINEUP_MARKER_RE = /#\s*\d+\s*회\s*인기가요\s*출연자\s*#/

/** Pure : extrait les artistes depuis le markdown du post Inkigayo. */
export function parseInkigayoPostLineup(postMarkdown: string): string[] {
  const markerMatch = postMarkdown.match(LINEUP_MARKER_RE)
  if (!markerMatch || markerMatch.index === undefined) return []

  // Collecter les lignes après le marker jusqu'à `* 출연자는 …` (disclaimer)
  // ou un séparateur markdown (`[이전]`, `* [` bullet).
  const afterMarker = postMarkdown.slice(markerMatch.index + markerMatch[0].length)
  const lines = afterMarker.split('\n')
  const collected: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (/^\*\s*출연자/.test(line)) break // disclaimer
    if (/^\[이전\]/.test(line)) break // nav
    if (/^\*\s*\[/.test(line)) break // bullet link
    if (/^\*\s/.test(line)) break // bullet
    if (/^#{1,6}\s/.test(line)) break // next header
    collected.push(line)
  }

  // Joindre + split sur ",".
  const joined = collected.join(' ')
  const parts = joined
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  return parts
}

export async function fetchInkigayo(now: Date = new Date()): Promise<ParsedLineup[]> {
  const result = await fetchSbsBoardLatestPost(BOARD_URL)
  if (!result) return []
  const { meta, postMarkdown } = result

  const artistsRaw = parseInkigayoPostLineup(postMarkdown)
  if (artistsRaw.length === 0) return []

  let startAtIso: string | null = null
  if (meta.monthDay) {
    const year = resolveBroadcastYear(meta)
    startAtIso = kstDateTimeToIso(year, meta.monthDay.month, meta.monthDay.day, 15, 25)
  }
  if (!startAtIso) {
    startAtIso = nextWeeklySlotIso('inkigayo', now)
  }

  return [
    {
      show: 'inkigayo',
      episodeNumber: meta.episodeNumber,
      startAtIso,
      isHighlight: false,
      artistsRaw,
      sourceLabel: SOURCE_LABEL,
    },
  ]
}

export const sbsInkigayoSource: SourceScraper = {
  label: SOURCE_LABEL,
  sourceUrl: BOARD_URL,
  shows: ['inkigayo'],
  fetch: fetchInkigayo,
}
