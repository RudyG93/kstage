import { localDayKey } from './date'
import { eventHref, isExternalHref } from './href'
import type { UpcomingEvent } from './queries'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

// Section « Later » : au plus 10 bannières, fenêtre = 4 semaines à partir de la
// semaine prochaine (≈ J+35). Au-delà = territoire du calendrier, hors feed.
const LATER_CAP = 10
const LATER_MAX_AHEAD_DAYS = 35

export interface CappedLater {
  display: UpcomingEvent[]
  moreCount: number
  moreHref: string | null
}

/**
 * Borne le bucket « later » : fenêtre ≤ J+35 ET ≤ 10 events affichés. `moreCount`
 * ne compte que l'overflow DANS la fenêtre (pas les events au-delà de J+35, qui
 * relèvent du calendrier) — évite l'effet « 1 event + 8 more » qui faisait vide.
 * `moreHref` pointe le calendrier au dernier jour affiché (fuseau utilisateur).
 */
export function capLaterEvents(
  later: UpcomingEvent[],
  nowMs: number = Date.now(),
  timeZone: string = 'Asia/Seoul',
): CappedLater {
  const limit = nowMs + LATER_MAX_AHEAD_DAYS * DAY_MS
  const within = later.filter((e) => new Date(e.start_at).getTime() <= limit)
  const display = within.slice(0, LATER_CAP)
  const moreCount = within.length - display.length
  const last = display[display.length - 1]
  const dayKey = last ? localDayKey(last.start_at, timeZone) : null
  const moreHref = dayKey ? `/calendar?month=${dayKey.slice(0, 7)}&day=${dayKey}` : null
  return { display, moreCount, moreHref }
}

/** UpcomingEvent + lineup optionnel (présent si ≥ 2 groupes fusionnés). */
export type GroupedUpcomingEvent = UpcomingEvent & { lineup?: UpcomingEvent[] }

/**
 * Regroupe les music shows par épisode : un même « Music Bank » est stocké une
 * ligne PAR GROUPE du lineup (contrainte scraper) → N cartes identiques à
 * l'affichage. Clé de fusion : (title, start_at) — title vient d'un enum fixe
 * de 6 shows, l'épisode est en colonne `episode_number`, jamais dans le titre.
 *
 * Seules les lignes au href INTERNE fusionnent : avant diffusion les lignes
 * partagent la même source carrd (redondantes) ; après enrichissement
 * stage-links, chaque ligne porte SON stage YouTube par groupe (divergentes,
 * on les laisse individuelles pour ne pas détruire ces liens).
 *
 * Préserve l'ordre d'entrée (les membres d'un épisode partagent start_at, donc
 * sont contigus dans une liste triée). Représentant = 1ʳᵉ occurrence ;
 * `episode_number` = premier non-null du lineup ; `lineup` absent si singleton
 * (rendu strictement identique à aujourd'hui).
 */
export function groupMusicShowEpisodes(events: readonly UpcomingEvent[]): GroupedUpcomingEvent[] {
  const byEpisode = new Map<string, GroupedUpcomingEvent>()
  const out: GroupedUpcomingEvent[] = []

  for (const e of events) {
    if (e.type !== 'music_show' || isExternalHref(eventHref(e))) {
      out.push(e)
      continue
    }
    const key = `${e.title}|${e.start_at}`
    const existing = byEpisode.get(key)
    if (!existing) {
      const rep: GroupedUpcomingEvent = { ...e, lineup: [e] }
      byEpisode.set(key, rep)
      out.push(rep)
      continue
    }
    existing.lineup!.push(e)
    if (existing.episode_number == null && e.episode_number != null) {
      existing.episode_number = e.episode_number
    }
  }

  // Singletons : pas de lineup → comportement 100 % inchangé en aval.
  for (const rep of byEpisode.values()) {
    if (rep.lineup!.length === 1) delete rep.lineup
  }
  return out
}

/** « ATEEZ, RIIZE, izna +2 » — au plus `max` noms, puis le reste en +N. */
export function lineupLabel(names: readonly string[], max = 3): string {
  const listed = names.slice(0, max).join(', ')
  const more = names.length > max ? ` +${names.length - max}` : ''
  return listed + more
}

/** Sépare des events (triés par start_at) en « cette semaine » (≤ 7 j) et « plus tard ». */
export function splitUpcomingByWeek(events: UpcomingEvent[], nowMs: number = Date.now()) {
  const weekEnd = nowMs + WEEK_MS
  const thisWeek = events.filter((e) => new Date(e.start_at).getTime() <= weekEnd)
  const later = events.filter((e) => new Date(e.start_at).getTime() > weekEnd)
  return { thisWeek, later }
}

export interface UpcomingBuckets {
  today: UpcomingEvent[]
  tomorrow: UpcomingEvent[]
  thisWeek: UpcomingEvent[]
  later: UpcomingEvent[]
}

/**
 * Sépare des events triés en 4 buckets, dans le fuseau de l'utilisateur :
 *  - `today`     = même clé jour (tz user) que maintenant
 *  - `tomorrow`  = clé jour = J+1
 *  - `thisWeek`  = clé jour entre J+2 et J+7 inclus
 *  - `later`     = > J+7
 *
 * La comparaison se fait sur les clés `YYYY-MM-DD` (localDayKey) plutôt qu'en
 * millisecondes : un event à 23h59 locale « aujourd'hui » reste bien dans
 * `today`, sans risquer de basculer dans `tomorrow` à cause d'un offset UTC.
 *
 * `timeZone` doit être un fuseau IANA (ex 'Europe/Paris'). Défaut 'Asia/Seoul'
 * pour préserver le comportement historique des appelants non encore migrés.
 */
export function splitUpcomingByBuckets(
  events: UpcomingEvent[],
  nowMs: number = Date.now(),
  timeZone: string = 'Asia/Seoul',
): UpcomingBuckets {
  const nowIso = new Date(nowMs).toISOString()
  const tomorrowIso = new Date(nowMs + DAY_MS).toISOString()
  const weekEndIso = new Date(nowMs + WEEK_MS).toISOString()
  const todayKey = localDayKey(nowIso, timeZone)
  const tomorrowKey = localDayKey(tomorrowIso, timeZone)
  const weekEndKey = localDayKey(weekEndIso, timeZone)

  const buckets: UpcomingBuckets = { today: [], tomorrow: [], thisWeek: [], later: [] }
  for (const e of events) {
    const key = localDayKey(e.start_at, timeZone)
    if (key === todayKey) buckets.today.push(e)
    else if (key === tomorrowKey) buckets.tomorrow.push(e)
    else if (key <= weekEndKey) buckets.thisWeek.push(e)
    else buckets.later.push(e)
  }
  return buckets
}
