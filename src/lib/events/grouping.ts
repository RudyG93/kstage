import { kstDayKey, localDayKey } from './date'
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
/**
 * Dédup préalable, conservée en défense en profondeur : la cause racine des
 * doublons DB (l'enrichissement stage-links mutait source_url, partie de la
 * clé d'idempotence du scraper) est corrigée depuis la migration 0039
 * (colonne `stage_url` dédiée + purge des paires) — cf. SCRAPING.md §3.14.
 * Si un doublon réapparaissait, on garde la row enrichie (href externe).
 */
function dedupePerGroupEpisode(events: readonly UpcomingEvent[]): UpcomingEvent[] {
  const seen = new Map<string, number>() // key → index dans out
  const out: UpcomingEvent[] = []
  for (const e of events) {
    if (e.type !== 'music_show') {
      out.push(e)
      continue
    }
    // Jour KST, pas start_at exact (fix 2026-07-12) : un time-shift du carrd
    // (15:15 → 15:20 le 11/07) faisait deux « épisodes » du même show.
    const key = `${e.group_id}|${e.title}|${kstDayKey(e.start_at)}`
    const at = seen.get(key)
    if (at === undefined) {
      seen.set(key, out.length)
      out.push(e)
      continue
    }
    // Doublon : préférer la row ENRICHIE (stage_url posé). Critère direct sur
    // la colonne — l'ancien test « href externe » ne discrimine plus depuis
    // que tous les music_show routent vers la page épisode (Lot N 2026-07-17).
    if (e.stage_url && !out[at].stage_url) {
      out[at] = e
    }
  }
  return out
}

export function groupMusicShowEpisodes(events: readonly UpcomingEvent[]): GroupedUpcomingEvent[] {
  const byEpisode = new Map<string, GroupedUpcomingEvent>()
  const out: GroupedUpcomingEvent[] = []

  for (const e of dedupePerGroupEpisode(events)) {
    // Depuis la page épisode (Lot N 2026-07-17), TOUTES les rows music_show
    // routent en interne — les rows à stage_url ne sortent plus du groupe
    // (leur vidéo vit dans la page épisode). L'exclusion href-externe ne garde
    // que le repli des shows inconnus du descripteur.
    if (e.type !== 'music_show' || isExternalHref(eventHref(e))) {
      out.push(e)
      continue
    }
    const key = `${e.title}|${kstDayKey(e.start_at)}`
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

/** « ATEEZ, RIIZE, izna & 2 more » — au plus `max` noms, puis le reste en
 * « & N more » (le « +N » sec faisait peu sérieux — retour Rudy 2026-07-17). */
export function lineupLabel(names: readonly string[], max = 3): string {
  const listed = names.slice(0, max).join(', ')
  const more = names.length > max ? ` & ${names.length - max} more` : ''
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

/**
 * Regroupe les events d'un même groupe côte à côte dans la liste d'un jour
 * (retour Rudy R6 : deux sorties Young Posse le même jour doivent se suivre).
 * L'ordre chronologique fixe la position d'ANCRAGE (premier event du groupe) ;
 * ses autres events du jour remontent juste après. Stable pour le reste.
 */
export function clusterByGroup<
  T extends { group_id?: string | null; groups?: { name: string } | null },
>(events: readonly T[]): T[] {
  const keyOf = (e: T) => e.group_id ?? e.groups?.name ?? null
  const out: T[] = []
  const done = new Set<number>()
  for (let i = 0; i < events.length; i++) {
    if (done.has(i)) continue
    out.push(events[i])
    done.add(i)
    const key = keyOf(events[i])
    if (key == null) continue
    for (let j = i + 1; j < events.length; j++) {
      if (!done.has(j) && keyOf(events[j]) === key) {
        out.push(events[j])
        done.add(j)
      }
    }
  }
  return out
}
