import { kstDayKey } from './date'
import type { UpcomingEvent } from './queries'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

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
 * Sépare des events triés en 4 buckets KST-aware :
 *  - `today`     = même clé jour KST que maintenant
 *  - `tomorrow`  = clé jour KST = J+1
 *  - `thisWeek`  = clé jour KST entre J+2 et J+7 inclus
 *  - `later`     = > J+7
 *
 * La comparaison se fait sur les clés `YYYY-MM-DD` (kstDayKey) plutôt qu'en
 * millisecondes : un event à 23h59 KST « aujourd'hui » reste bien dans
 * `today`, sans risquer de basculer dans `tomorrow` à cause d'un offset UTC.
 */
export function splitUpcomingByBuckets(
  events: UpcomingEvent[],
  nowMs: number = Date.now(),
): UpcomingBuckets {
  const nowIso = new Date(nowMs).toISOString()
  const tomorrowIso = new Date(nowMs + DAY_MS).toISOString()
  const weekEndIso = new Date(nowMs + WEEK_MS).toISOString()
  const todayKey = kstDayKey(nowIso)
  const tomorrowKey = kstDayKey(tomorrowIso)
  const weekEndKey = kstDayKey(weekEndIso)

  const buckets: UpcomingBuckets = { today: [], tomorrow: [], thisWeek: [], later: [] }
  for (const e of events) {
    const key = kstDayKey(e.start_at)
    if (key === todayKey) buckets.today.push(e)
    else if (key === tomorrowKey) buckets.tomorrow.push(e)
    else if (key <= weekEndKey) buckets.thisWeek.push(e)
    else buckets.later.push(e)
  }
  return buckets
}
