/**
 * Récolte « ce qui a RÉELLEMENT été diffusé », depuis la chaîne YouTube du
 * diffuseur (round 2026-08-21).
 *
 * Pourquoi : jusqu'ici tout le pipeline music-shows dépendait d'un lineup
 * PRÉVISIONNEL (carrd fan / boards broadcaster) capté dans une fenêtre étroite.
 * Trois conséquences mesurées en prod le 2026-08-21 :
 *   — 20 épisodes MANQUANTS sur 13 semaines (The Show 4/13, Inkigayo 6/13) :
 *     une semaine ratée l'était pour toujours, rien ne repassait derrière ;
 *   — des passages ABSENTS (Show Champion EP.608 : 2 groupes en base, KISS OF
 *     LIFE avait pourtant sa scène sur la chaîne) ;
 *   — des passages FANTÔMES : M Countdown EP.941 (13/08) portait 10 groupes en
 *     base alors que l'épisode était un spécial « MCD Summer Camp » — un seul
 *     des 10 y est réellement passé.
 *
 * Or le titre de chaque vidéo postée par le diffuseur porte la vérité :
 *   Mnet          'COMEBACK' WayV - Vision Wings #엠카운트다운 EP.942 | Mnet 260820 방송
 *   KBS           [K-Fancam] 엔하이픈 제이 'Bloody Paradise' @뮤직뱅크(Music Bank) 260821
 *   MBC           [#최애직캠] KiiiKiii KYA – Pop Off Pop Off | 쇼! 음악중심 | MBC260815
 *   SBS Inkigayo  [안방1열 풀캠4K] 웨이션브이 'Vision Wings' (WayV FullCam) @SBS Inkigayo 260816
 *   Show Champion [쇼챔직캠 4K] WayV KUN - Vision Wings | Show Champion | EP.608 | 260819
 *   The Show      [JJaeLiView] KISS OF LIFE [THE SHOW] 260811 방송
 *
 * → date de DIFFUSION explicite (YYMMDD) et, chez Mnet/Show Champion, le
 *   numéro d'épisode du diffuseur lui-même. On ne devine plus : on lit.
 */

import type { UploadItem } from '../youtube'
import { SHOW_DESCRIPTORS, type ShowId } from './types'

/** ShowId → jour de diffusion KST (0 = dimanche), depuis les descripteurs. */
const WEEKDAY_BY_SHOW = Object.fromEntries(
  SHOW_DESCRIPTORS.map((s) => [s.id, s.slot.weekday]),
) as Record<ShowId, number>

/**
 * YYMMDD non collé à d'autres chiffres. Bornes serrées (années 24-35, mois
 * 01-12, jour 01-31) : « EP.230 » ou un compteur de vues ne peuvent pas passer.
 * Le vrai filtre reste en aval — jour de la semaine + proximité de publication.
 */
const YYMMDD_RE = /(?<![0-9])(2[4-9]|3[0-5])(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])(?![0-9])/g

/** Jour de la semaine (0-6) d'une date ISO pure, sans dépendance au fuseau. */
function weekdayOf(isoDay: string): number {
  return new Date(`${isoDay}T00:00:00Z`).getUTCDay()
}

const DAY_MS = 86_400_000

/**
 * Date de diffusion (jour KST « YYYY-MM-DD ») lue DANS le titre, ou null.
 *
 * Trois validations, toutes nécessaires — un titre de diffuseur contient
 * souvent plusieurs nombres :
 *   1. le jour de la semaine doit être le créneau officiel du show ;
 *   2. la diffusion ne peut pas suivre la publication de plus de 2 jours
 *      (les teasers d'avant-diffusion existent, l'inverse non) ;
 *   3. ni la précéder de plus de 45 jours (compilations « .zip » anciennes).
 */
export function parseAirDate(title: string, showId: ShowId, publishedAtIso: string): string | null {
  const publishedMs = Date.parse(publishedAtIso)
  if (Number.isNaN(publishedMs)) return null
  const wanted = WEEKDAY_BY_SHOW[showId]
  for (const m of title.matchAll(YYMMDD_RE)) {
    const day = `20${m[1]}-${m[2]}-${m[3]}`
    const dayMs = Date.parse(`${day}T00:00:00Z`)
    if (Number.isNaN(dayMs)) continue
    if (weekdayOf(day) !== wanted) continue
    const delta = publishedMs - dayMs
    if (delta < -2 * DAY_MS || delta > 45 * DAY_MS) continue
    return day
  }
  return null
}

/**
 * Numéro d'épisode annoncé par le DIFFUSEUR (« EP.942 », « EP. 608 »).
 * Uniquement pour les shows dont le format a été vérifié le 2026-08-21 :
 * ailleurs un « EP.230 » appartient à une autre émission de la même chaîne
 * (KBS poste « 리무진서비스 EP.230 » sur le canal de Music Bank).
 */
const EPISODE_SHOWS = new Set<ShowId>(['m-countdown', 'show-champion'])
const EPISODE_RE = /\bEP\.?\s*(\d{2,4})\b/i

export function parseEpisodeNumber(title: string, showId: ShowId): number | null {
  if (!EPISODE_SHOWS.has(showId)) return null
  const n = Number(EPISODE_RE.exec(title)?.[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

export interface HarvestedEpisode {
  /** Jour KST « YYYY-MM-DD ». */
  kstDay: string
  /** Numéro CORROBORÉ par ≥ 2 vidéos, sinon null — on ne devine jamais. */
  episodeNumber: number | null
  /** Toutes les vidéos rattachées à cette diffusion (scènes ET fancams). */
  videos: UploadItem[]
}

/**
 * Regroupe les uploads d'une chaîne par diffusion. N'accepte QUE les vidéos
 * dont le titre porte le marqueur du show ET une date de diffusion explicite :
 * une entrée de ce dictionnaire est une preuve, pas une supposition.
 */
export function harvestEpisodes(
  uploads: readonly UploadItem[],
  showId: ShowId,
  marker: RegExp,
): HarvestedEpisode[] {
  const byDay = new Map<string, { videos: UploadItem[]; numbers: number[] }>()
  for (const u of uploads) {
    if (!marker.test(u.title)) continue
    const day = parseAirDate(u.title, showId, u.publishedAt)
    if (!day) continue
    const slot = byDay.get(day) ?? { videos: [], numbers: [] }
    slot.videos.push(u)
    const ep = parseEpisodeNumber(u.title, showId)
    if (ep != null) slot.numbers.push(ep)
    byDay.set(day, slot)
  }
  return [...byDay.entries()]
    .map(([kstDay, { videos, numbers }]) => ({
      kstDay,
      episodeNumber: corroborate(numbers),
      videos,
    }))
    .sort((a, b) => a.kstDay.localeCompare(b.kstDay))
}

/**
 * Numéro retenu seulement s'il est majoritaire ET vu ≥ 2 fois : une coquille
 * isolée dans un titre ne doit pas devenir l'autorité (leçon du carrd décalé,
 * round 2026-07-18).
 */
export function corroborate(numbers: readonly number[]): number | null {
  if (numbers.length < 2) return null
  const tally = new Map<number, number>()
  for (const n of numbers) tally.set(n, (tally.get(n) ?? 0) + 1)
  const [best, count] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
  return count >= 2 && count > numbers.length / 2 ? best : null
}
