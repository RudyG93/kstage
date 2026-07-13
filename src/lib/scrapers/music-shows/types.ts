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
  // Avatar de la chaîne YouTube officielle du diffuseur (fetch channels.list
  // du 2026-07-13, R5) : visuel des bandeaux « Lineup TBA » à la place de
  // l'initiale. Les URLs yt3.ggpht sont stables tant que la chaîne ne change
  // pas de logo — rafraîchissement manuel acceptable.
  iconUrl: string
}

export const SHOW_DESCRIPTORS: readonly ShowDescriptor[] = [
  {
    id: 'the-show',
    displayName: 'The Show',
    slot: { weekday: 2, hour: 18, minute: 0 },
    iconUrl:
      'https://yt3.ggpht.com/ak7rvwiEaaJDbiau5F_o_oV6wHqAUZwORy_-ALQyI2IEJjo_m9IAxAecX7Og1UY93TiVxs9Zgw=s88-c-k-c0x00ffffff-no-rj',
  },
  {
    id: 'show-champion',
    displayName: 'Show Champion',
    slot: { weekday: 3, hour: 17, minute: 0 },
    iconUrl:
      'https://yt3.ggpht.com/KmtLGIgpEOIRca9yfl8WzQedKkkooLw7kszl0ieVBfq7aq9u6PmFLdMIYAF2FcDONszSl1JZbA=s88-c-k-c0x00ffffff-no-rj',
  },
  {
    id: 'm-countdown',
    displayName: 'M Countdown',
    slot: { weekday: 4, hour: 18, minute: 0 },
    iconUrl:
      'https://yt3.ggpht.com/xPBuFrafbL_6Opr8UVDVKinGSQRqv1432LMo-7tRojZpdOd7N3hLeCegoQPX45iKEvQnnIrx=s88-c-k-c0x00ffffff-no-rj',
  },
  {
    id: 'music-bank',
    displayName: 'Music Bank',
    slot: { weekday: 5, hour: 17, minute: 0 },
    iconUrl:
      'https://yt3.ggpht.com/bfuCyrlo74z5K_0A1voFD7leSSlafqfb953tFQ4Oe5X9CFDN23X_vm07yV8f_YCY63dxBjiB=s88-c-k-c0x00ffffff-no-rj',
  },
  {
    id: 'music-core',
    displayName: 'Music Core',
    slot: { weekday: 6, hour: 15, minute: 15 },
    iconUrl:
      'https://yt3.ggpht.com/lMLCpSdIgJNZ11RW-0hyfU3Xb4f-molFbQFPn_302s1BAjJUFL8298P4Sbz_W76YEWtwscXi-48=s88-c-k-c0x00ffffff-no-rj',
  },
  {
    id: 'inkigayo',
    displayName: 'Inkigayo',
    slot: { weekday: 0, hour: 15, minute: 25 },
    iconUrl:
      'https://yt3.ggpht.com/GqzNZfMlBCgXYpAA74wuCs9HTEJ7ePtImt6QpXwk2qt6LJEIrZ8hEdPHeLPusnCCqoEGJb1pEQ=s88-c-k-c0x00ffffff-no-rj',
  },
] as const

// displayName (« Music Bank ») → avatar broadcaster, pour les surfaces UI
// (queue-row) qui n'ont que le titre de l'event.
export const SHOW_ICON_BY_TITLE: Record<string, string> = Object.fromEntries(
  SHOW_DESCRIPTORS.map((s) => [s.displayName, s.iconUrl]),
)

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
