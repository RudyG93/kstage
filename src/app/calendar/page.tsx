import { Suspense } from 'react'
import { LeftRail } from '@/components/layout/page-rails'
import { RailStack } from '@/components/rails/rail-stack'
import { JustAnnouncedBlock } from '@/components/rails/event-blocks'
import { RookiesBlock } from '@/components/rails/discovery-blocks'
import { RailSkeleton } from '@/components/ui/rail-skeleton'
import { GroupFilter } from '@/components/home/group-filter'
import { FilterChips } from '@/components/calendar/filter-chips'
import { MobileGroupFilter } from '@/components/calendar/mobile-group-filter'
import { CalendarFilterProvider, CalendarEvents } from '@/components/calendar/calendar-filters'
import { getCalendarMonthEvents } from '@/lib/events/calendar-month'
import { getGroupsCached } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { kstDayKey, isFutureDate } from '@/lib/events/date'
import { getViewerTimeZone } from '@/lib/profiles/timezone'
import { TrackView } from '@/components/analytics/track-view'

function parseMonth(raw?: string): { year: number; month: number } {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number)
    if (m >= 1 && m <= 12) return { year: y, month: m }
  }
  const [y, m] = kstDayKey(new Date().toISOString()).split('-').map(Number)
  return { year: y, month: m }
}

export const metadata = {
  title: 'Calendar',
  description: 'Every k-pop comeback, MV drop, music show and birthday — day by day, in KST.',
  alternates: { canonical: '/calendar' },
}

// Filtrage 100 % CLIENT (2026-07-12, retour Rudy « chaque coche = navigation
// lente ») : le serveur charge le mois ENTIER non filtré (events + anniv +
// slots, ~50-130 rows) ; groupes/types se filtrent en mémoire dans
// CalendarFilterProvider. L'URL ne porte plus que ?month (+ ?day deep-link).
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string; group?: string; src?: string }>
}) {
  const sp = await searchParams
  const { year, month } = parseMonth(sp.month)

  const [groups, followedIds, events, timeZone] = await Promise.all([
    getGroupsCached(),
    getFollowedGroupIds(),
    // Assemblage partagé avec /api/calendar/month (nav de mois client).
    getCalendarMonthEvents(year, month),
    getViewerTimeZone(),
  ])
  const followedSlugs = groups.filter((g) => followedIds.has(g.id)).map((g) => g.slug)

  // North-star (audit §10.2) : /calendar compte comme « calendrier perso »
  // dès que le viewer a ≥1 follow ; « prêt » = ≥1 event FUTUR d'un groupe suivi
  // dans le mois affiché. Dédup 1/jour côté serveur.
  const followedSet = new Set(followedSlugs)
  const hasUpcomingFollowed = events.some(
    (e) => e.groups?.slug && followedSet.has(e.groups.slug) && isFutureDate(e.start_at),
  )

  return (
    <CalendarFilterProvider
      events={events}
      initialMonth={{ year, month }}
      followedSlugs={followedSlugs}
      allGroups={groups.map((g) => ({ slug: g.slug, name: g.name }))}
      initialSlugs={sp.group ? sp.group.split(',').filter(Boolean) : undefined}
    >
      {followedSlugs.length > 0 && (
        <TrackView
          event="calendar_opened"
          props={{ surface: 'calendar', ...(sp.src === 'push' ? { src: 'push' } : {}) }}
        />
      )}
      {followedSlugs.length > 0 && hasUpcomingFollowed && (
        <TrackView event="personal_calendar_ready" props={{ surface: 'calendar' }} />
      )}
      <div className="mx-auto w-full max-w-[1400px] px-3 py-4 md:px-4 md:py-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Suspense fallback={null}>
            {/* Le filtre Group reste accessible aux deconnectes : MobileGroupFilter
                le rend juste en dessous, sur toutes les tailles d'ecran. */}
            <LeftRail
              className="order-2 shrink-0 lg:order-1 lg:w-60"
              groupFilter={<GroupFilter />}
              showFilters
            />
          </Suspense>
          <div className="order-1 min-w-0 flex-1 space-y-3 lg:order-2">
            <MobileGroupFilter>
              <GroupFilter />
            </MobileGroupFilter>
            <FilterChips />
            <CalendarEvents timeZone={timeZone} />
          </div>
          {/* Rail contextuel (Lot 6) : « Just announced » = events futurs
              triés par date de DÉTECTION — la fraîcheur, que la grille (triée
              par date d'event) ne montre pas. Pas de lien de sortie : la page
              courante est déjà le calendrier. */}
          <aside className="order-3 shrink-0 lg:w-80">
            <Suspense fallback={<RailSkeleton />}>
              <RailStack>
                <JustAnnouncedBlock />
                {/* Discussions ne rendait rien ici non plus. La grille du mois
                    dit ce qui se passe, jamais qui vient d'arriver. */}
                <RookiesBlock />
              </RailStack>
            </Suspense>
          </aside>
        </div>
      </div>
    </CalendarFilterProvider>
  )
}
