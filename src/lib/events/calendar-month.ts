import { getEventsForMonth, type UpcomingEvent } from '@/lib/events/queries'
import { getAnniversariesForMonth } from '@/lib/events/anniversaries'
import { generateShowSlots } from '@/lib/events/show-slots'
import { getKstMonthRange } from '@/lib/events/date'

/**
 * Mois calendrier COMPLET (db + anniversaires + slots synthétiques), trié —
 * assemblage partagé entre la page /calendar (rendu initial SSR) et le route
 * handler /api/calendar/month (navigation de mois 100 % client, round
 * 2026-07-18 : le changement de mois était une navigation RSC complète).
 */
export async function getCalendarMonthEvents(
  year: number,
  month: number,
): Promise<UpcomingEvent[]> {
  const [dbEvents, anniversaries] = await Promise.all([
    getEventsForMonth({ year, month }),
    getAnniversariesForMonth({ year, month }),
  ])
  const { startISO, endISO } = getKstMonthRange(year, month)
  const showSlots = generateShowSlots({ fromIso: startISO, toIso: endISO, existing: dbEvents })
  return [...dbEvents, ...anniversaries, ...showSlots].sort((a, b) =>
    a.start_at.localeCompare(b.start_at),
  )
}
