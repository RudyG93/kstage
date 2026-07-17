/**
 * Fallback scraper Mnet M Countdown — page lineup officielle MnetPlus.
 *
 * Format observé (fixture 2026-05-29) :
 *   - Pas de date broadcast explicite sur la page (la date `2026.01.08` au top
 *     correspond à la mise en ligne du cast initial, pas au broadcast courant).
 *   - Liste des artistes : suite de blocs `![Image N](...)\n\nARTIST_NAME\n\n`
 *     APRÈS la zone de navigation/MC.
 *   - Marqueur de début : ligne contenant le mot `Cast` ou le ![Image] juste
 *     après le lien `Lineup`.
 *
 * Stratégie : on cherche le marker "Cast" pour repérer la fin de la zone meta,
 * puis on collecte tous les noms sur des lignes "isolées" (1 mot ou groupe de
 * mots NON-precédé par un `*`/`#`/`[`) qui suivent un `![Image`.
 *
 * Date du broadcast : déduite via `nextWeeklySlotIso('m-countdown', now)` —
 * Thursday 18:00 KST.
 */

import { nextWeeklySlotIso } from '../slots'
import type { ParsedLineup, SourceScraper } from '../types'
import { fetchViaJina } from '../jina-fetch'

export const SOURCE_URL =
  'https://www.mnetplus.world/contents/en/shows/675aa046f350a1a1c97035b3/lineup'
const SOURCE_LABEL = 'mnet-mcountdown'

/** Pure : extrait les artistes depuis le markdown brut MnetPlus. */
export function parseMnetMcountdown(markdown: string): { artistsRaw: string[] } | null {
  // On scinde en lignes et on cherche le bloc des artistes : après "Cast" + MC
  // line, chaque artiste a son ![Image …] suivi d'une ligne "ARTIST_NAME".
  const lines = markdown.split('\n')

  // Trouver l'index où commence la zone lineup (juste après la nav "Lineup" ou
  // après la 1ʳᵉ Image qui n'est ni logo nav ni avatar MC).
  // Stratégie simple : on collecte les lignes qui SUIVENT un `![Image` ET qui
  // ne sont pas elles-mêmes des Image / Markdown bullet / lien.
  const artistsRaw: string[] = []
  // Skip jusqu'au 1ᵉʳ block `![Image N]` qui apparaît APRÈS la ligne de nav
  // "Videos | Images | Lineup | Chart | Basic Info". Si on ne trouve pas la
  // nav, on saute juste les 4 premières images (logos GNB + kcon hub).
  let lineupStart = lines.findIndex((l) => /\[Lineup\]/i.test(l))
  if (lineupStart === -1) {
    // fallback : ignorer les 4 premières images
    let imageCount = 0
    for (let i = 0; i < lines.length; i++) {
      if (/!\[Image\s*\d+\]/.test(lines[i])) {
        imageCount++
        if (imageCount === 4) {
          lineupStart = i
          break
        }
      }
    }
  }
  if (lineupStart === -1) return null

  let lastWasImage = false
  for (let i = lineupStart + 1; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line) continue
    if (/!\[Image\s*\d+\]/.test(line)) {
      lastWasImage = true
      continue
    }
    if (/^#{1,6}\s/.test(line)) break // header markdown = fin probable de la zone
    // Skip nav/link/bullet patterns sans break (la nav bullet apparaît entre
    // le marker [Lineup] et le 1ᵉʳ image artiste sur la fixture MnetPlus).
    if (/^\*\s/.test(line)) continue
    if (/^\[/.test(line)) continue
    if (lastWasImage) {
      artistsRaw.push(line)
      lastWasImage = false
    }
  }

  if (artistsRaw.length === 0) return null
  return { artistsRaw }
}

export async function fetchMnetMcountdown(now: Date = new Date()): Promise<ParsedLineup[]> {
  const markdown = await fetchViaJina(SOURCE_URL)
  const parsed = parseMnetMcountdown(markdown)
  if (!parsed) return []
  return [
    {
      show: 'm-countdown',
      episodeNumber: null,
      startAtIso: nextWeeklySlotIso('m-countdown', now),
      isHighlight: false,
      artistsRaw: parsed.artistsRaw,
      sourceLabel: SOURCE_LABEL,
    },
  ]
}

export const mnetMcountdownSource: SourceScraper = {
  label: SOURCE_LABEL,
  sourceUrl: SOURCE_URL,
  shows: ['m-countdown'],
  fetch: fetchMnetMcountdown,
}
