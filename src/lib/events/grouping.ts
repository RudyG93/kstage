import type { UpcomingEvent } from './queries'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Sépare des events (triés par start_at) en « cette semaine » (≤ 7 j) et « plus tard ». */
export function splitUpcomingByWeek(events: UpcomingEvent[], nowMs: number = Date.now()) {
  const weekEnd = nowMs + WEEK_MS
  const thisWeek = events.filter((e) => new Date(e.start_at).getTime() <= weekEnd)
  const later = events.filter((e) => new Date(e.start_at).getTime() > weekEnd)
  return { thisWeek, later }
}
