/**
 * Fallback scraper SBS Fun-E THE SHOW — 2-level scrape via board.
 *
 *   1. Board `programs.sbs.co.kr/fune/theshow/boards/64513` → URL du post le
 *      plus récent (ex `board_no=112519` pour Ep 393).
 *   2. Post → sections `# The Show ... Stage #` ; chaque artiste est entre
 *      `**ARTIST_NAME (alias) [SONG_TITLE]**`. On extrait la partie AVANT
 *      le `[` dans chaque bloc bold.
 *
 * Heure : Tuesday 18:00 KST (fixe, cf. types.ts).
 *
 * ⚠️ The Show est régulièrement en hiatus → la fixture 2026-05-29 montre
 * Ep 393 du 2025-11-11 (le dernier broadcast avant hiatus). Quand le show
 * reprend, la board est mise à jour. La logique d'idempotence (unique
 * constraint) protège contre les re-inserts d'events déjà connus.
 */

import { kstDateTimeToIso, nextWeeklySlotIso } from '../slots'
import type { ParsedLineup, SourceScraper } from '../types'
import { fetchSbsBoardLatestPost, resolveBroadcastYear } from './sbs-board'

export const BOARD_URL = 'https://programs.sbs.co.kr/fune/theshow/boards/64513'
const SOURCE_LABEL = 'sbs-the-show'

/**
 * Pure : extrait les artistes depuis le markdown d'un post The Show.
 * Pattern : `**ARTIST (alias) [SONG_TITLE]**` — on prend tout ce qui précède
 * le `[` à l'intérieur de chaque bloc bold.
 *
 * On limite la recherche à la zone entre le 1ᵉʳ `# The Show ... Stage #`
 * header et le bloc `[이전]` (next-page nav) pour éviter de capturer du noise.
 */
export function parseTheShowPostLineup(postMarkdown: string): string[] {
  // Bornes de la zone d'extraction.
  const startMatch = postMarkdown.search(/#\s*The\s*Show[^#]*Stage\s*#/i)
  if (startMatch === -1) return []
  const tail = postMarkdown.slice(startMatch)
  const endMatch = tail.search(/\[이전\]/)
  const body = endMatch === -1 ? tail : tail.slice(0, endMatch)

  // Extract artistes : pattern `**...[...]**`
  const artists: string[] = []
  const re = /\*\*([^*]+?)\s*\[[^\]]*\]\*\*/g
  for (const m of body.matchAll(re)) {
    const candidate = m[1].trim()
    if (!candidate) continue
    // Filtrer les en-têtes de section (ex "The Show Comeback Stage").
    if (/Stage\s*$/i.test(candidate)) continue
    artists.push(candidate)
  }
  return artists
}

export async function fetchTheShow(now: Date = new Date()): Promise<ParsedLineup[]> {
  const result = await fetchSbsBoardLatestPost(BOARD_URL)
  if (!result) return []
  const { meta, postMarkdown } = result

  const artistsRaw = parseTheShowPostLineup(postMarkdown)
  if (artistsRaw.length === 0) return []

  let startAtIso: string | null = null
  if (meta.monthDay) {
    const year = resolveBroadcastYear(meta)
    startAtIso = kstDateTimeToIso(year, meta.monthDay.month, meta.monthDay.day, 18, 0)
  }
  if (!startAtIso) {
    startAtIso = nextWeeklySlotIso('the-show', now)
  }

  return [
    {
      show: 'the-show',
      episodeNumber: meta.episodeNumber,
      startAtIso,
      isHighlight: false,
      artistsRaw,
      sourceLabel: SOURCE_LABEL,
    },
  ]
}

export const sbsTheShowSource: SourceScraper = {
  label: SOURCE_LABEL,
  sourceUrl: BOARD_URL,
  shows: ['the-show'],
  fetch: fetchTheShow,
}
