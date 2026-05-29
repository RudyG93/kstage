/**
 * Types partagés par tous les scrapers music-shows (primary `live-show-updates`
 * + fallbacks par broadcaster).
 *
 * Cf. `aggregator.ts` pour la stratégie de chaînage primary → fallbacks.
 */

export type ShowId =
  | 'the-show'
  | 'show-champion'
  | 'm-countdown'
  | 'music-bank'
  | 'music-core'
  | 'inkigayo'

export interface ShowDescriptor {
  id: ShowId
  displayName: string
  // Créneau hebdo officiel (KST). Utilisé par les fallbacks qui ne savent pas
  // extraire la date du HTML (cas MnetPlus M Countdown). Cf. `slots.ts`.
  // weekday : 0=dimanche … 6=samedi (cohérence avec Date.getUTCDay())
  slot: { weekday: number; hour: number; minute: number }
}

export const SHOW_DESCRIPTORS: readonly ShowDescriptor[] = [
  { id: 'the-show', displayName: 'The Show', slot: { weekday: 2, hour: 18, minute: 0 } },
  { id: 'show-champion', displayName: 'Show Champion', slot: { weekday: 3, hour: 17, minute: 0 } },
  { id: 'm-countdown', displayName: 'M Countdown', slot: { weekday: 4, hour: 18, minute: 0 } },
  { id: 'music-bank', displayName: 'Music Bank', slot: { weekday: 5, hour: 17, minute: 0 } },
  { id: 'music-core', displayName: 'Music Core', slot: { weekday: 6, hour: 15, minute: 15 } },
  { id: 'inkigayo', displayName: 'Inkigayo', slot: { weekday: 0, hour: 15, minute: 25 } },
] as const

export interface ParsedLineup {
  show: ShowId
  /** Numéro d'épisode, null si la source ne le fournit pas. */
  episodeNumber: number | null
  /** Datetime UTC ISO 8601 du broadcast. */
  startAtIso: string
  /** True pour les rediffusions Show Champion. */
  isHighlight: boolean
  /** Liste brute, à passer à `extractCanonicalName` côté caller. */
  artistsRaw: string[]
  /** Label de la source qui a produit ce lineup (pour debug/log). */
  sourceLabel: string
}

/**
 * Interface d'un scraper de source. Implémentée par chaque module dans
 * `sources/*`. Le `aggregator` enchaîne primary + fallbacks via cette
 * abstraction.
 */
export interface SourceScraper {
  label: string
  /** Shows que ce scraper peut potentiellement fournir. */
  shows: readonly ShowId[]
  /** Fetch + parse. Doit throw en cas d'erreur réseau ; renvoie [] si pas de
   *  lineup trouvé (vs erreur fatale). */
  fetch(now: Date): Promise<ParsedLineup[]>
}
