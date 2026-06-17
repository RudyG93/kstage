import Link from 'next/link'
import { splitUpcomingByBuckets, capLaterEvents } from '@/lib/events/grouping'
import { groupEventsByDay, kstDayKey } from '@/lib/events/date'
import { HomeEventCard } from './event-card'
import { EmptyState } from '@/components/ui/empty-state'
import type { UpcomingEvent } from '@/lib/events/queries'

const BUCKET_CAP = 10

function dayLabel(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).formatToParts(new Date(iso))
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  // Maquette KStage Home.dc.html : libellé de jour en clair (« Fri · Oct 18 »),
  // ni mono ni majuscules — le mono reste réservé aux vraies données (heures).
  return `${part('weekday')} · ${part('month')} ${part('day')}`
}

function overflowHref(firstHiddenEvent: UpcomingEvent): string {
  const dayKey = kstDayKey(firstHiddenEvent.start_at)
  // dayKey format YYYY-MM-DD → month YYYY-MM
  return `/calendar?month=${dayKey.slice(0, 7)}&day=${dayKey}`
}

function FeedSection({
  label,
  events,
  compact,
  timeZone,
  more,
}: {
  label: string
  events: UpcomingEvent[]
  compact: boolean
  timeZone: string
  // `later` fournit une liste déjà bornée (≤ 10, ≤ 1 mois) + son overflow.
  // Les autres buckets cappent génériquement à BUCKET_CAP.
  more?: { count: number; href: string | null }
}) {
  const override = more !== undefined
  const visible = override ? events : events.slice(0, BUCKET_CAP)
  const hidden = override ? more.count : events.length - visible.length
  const moreHref = override ? more.href : hidden > 0 ? overflowHref(events[BUCKET_CAP]) : null
  const byDay = groupEventsByDay(visible, timeZone)
  return (
    <section>
      <div className="mb-4 flex items-center gap-4">
        <span className="text-foreground flex items-center gap-2 text-sm font-semibold">
          {label === 'Today' && (
            <span
              className="bg-teal size-2 rounded-full"
              style={{ boxShadow: '0 0 0 4px color-mix(in srgb, var(--teal) 18%, transparent)' }}
              aria-hidden
            />
          )}
          {label}
        </span>
        <span className="bg-border h-px flex-1" />
      </div>
      <div className="space-y-5">
        {[...byDay.entries()].map(([dayKey, dayEvents]) => (
          <div key={dayKey}>
            <p className="text-faint mb-1.5 text-[11px] font-medium">
              {dayLabel(dayEvents[0].start_at, timeZone)}
            </p>
            <div className="space-y-3">
              {dayEvents.map((event) => (
                <HomeEventCard key={event.id} event={event} compact={compact} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {hidden > 0 && moreHref && (
        <Link
          href={moreHref}
          className="text-muted-foreground hover:text-foreground mt-4 inline-block font-mono text-xs underline underline-offset-4"
        >
          + {hidden} more event{hidden > 1 ? 's' : ''}{' '}
          {override ? 'later' : `in ${label.toLowerCase()}`}
        </Link>
      )}
    </section>
  )
}

export function Feed({ events, timeZone }: { events: UpcomingEvent[]; timeZone: string }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="Your feed is quiet right now"
        description="Follow more groups to see their comebacks, releases and shows here as they're announced."
        action={{ label: 'Browse groups', href: '/groups' }}
      />
    )
  }

  // nowMs laissé au défaut (Date.now() dans la lib) pour ne pas appeler une
  // fonction impure dans le render ; on n'injecte que le fuseau utilisateur.
  const buckets = splitUpcomingByBuckets(events, undefined, timeZone)
  // 3 catégories (Rudy) : Today / This week (= demain + cette semaine) / Later.
  const thisWeek = [...buckets.tomorrow, ...buckets.thisWeek]
  const later = capLaterEvents(buckets.later, undefined, timeZone)

  return (
    <div className="space-y-8">
      {buckets.today.length > 0 && (
        <FeedSection label="Today" events={buckets.today} compact={false} timeZone={timeZone} />
      )}
      {thisWeek.length > 0 && (
        <FeedSection label="This week" events={thisWeek} compact={false} timeZone={timeZone} />
      )}
      {later.display.length > 0 && (
        <FeedSection
          label="Later"
          events={later.display}
          compact
          timeZone={timeZone}
          more={{ count: later.moreCount, href: later.moreHref }}
        />
      )}
    </div>
  )
}
