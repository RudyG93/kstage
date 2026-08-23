import { getEventsForMonth, type UpcomingEvent } from '@/lib/events/queries'
import { getAnniversariesForMonth } from '@/lib/events/anniversaries'
import { generateShowSlots } from '@/lib/events/show-slots'
import { getUpcomingPreemptions } from '@/lib/events/preemptions'
import { getMonthRangeInZone } from '@/lib/events/date'

/**
 * Mois calendrier COMPLET (db + anniversaires + slots synthétiques), trié —
 * assemblage partagé entre la page /calendar (rendu initial SSR) et le route
 * handler /api/calendar/month (navigation de mois 100 % client, round
 * 2026-07-18 : le changement de mois était une navigation RSC complète).
 */
export async function getCalendarMonthEvents(
  year: number,
  month: number,
  timeZone = 'Asia/Seoul',
): Promise<UpcomingEvent[]> {
  const [dbEvents, anniversaries, preempted] = await Promise.all([
    // La fenêtre suit le fuseau du viewer : la grille range les events par
    // jour civil LOCAL (groupEventsByEventDay), donc une fenêtre KST laissait
    // les bords du mois sans cellule nulle part.
    getEventsForMonth({ year, month, timeZone }),
    // Les anniversaires sont des dates pures ancrées minuit KST et relus en
    // KST par eventDayKey : leur mois se calcule bien en KST.
    getAnniversariesForMonth({ year, month }),
    getUpcomingPreemptions(),
  ])
  const { startISO, endISO } = getMonthRangeInZone(year, month, timeZone)
  const showSlots = generateShowSlots({
    fromIso: startISO,
    toIso: endISO,
    existing: dbEvents,
    preempted,
  })
  return [...dbEvents, ...anniversaries, ...showSlots]
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .map(slimForCalendar)
}

/**
 * Dégraissage flight (audit perf 2026-08-20 : /calendar = 180 Ko de RSC
 * inline, 49 % du HTML) : tout le mois part dans les props du provider client
 * ET dans le JSON de /api/calendar/month, mais la chaîne calendrier (grille,
 * QueueRow, eventHref, grouping) ne lit jamais source_url ni les visuels
 * larges du groupe (image_landscape/banner_url/color_hex — vérifié par grep,
 * seuls slug/name/image_url servent). NULL les champs lourds non consommés :
 * type préservé (tous nullable), ~0,5 Ko gagné par event × ~100 events × 2
 * (SSR + hydratation).
 */
function slimForCalendar(e: UpcomingEvent): UpcomingEvent {
  return {
    ...e,
    source_url: null,
    groups: e.groups
      ? { ...e.groups, color_hex: null, image_landscape: null, banner_url: null }
      : e.groups,
  }
}
