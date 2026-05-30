import Link from 'next/link'
import { splitUpcomingByBuckets, type UpcomingBuckets } from '@/lib/events/grouping'
import { groupEventsByKstDay, kstDayKey } from '@/lib/events/date'
import { HomeEventCard } from './event-card'
import type { UpcomingEvent } from '@/lib/events/queries'

const BUCKET_CAP = 10

type BucketKey = keyof UpcomingBuckets

const BUCKET_LABELS: Record<BucketKey, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  thisWeek: 'This week',
  later: 'Later',
}

function dayLabel(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  }).formatToParts(new Date(iso))
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('weekday')} · ${part('month')} ${part('day')}`.toUpperCase()
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
}: {
  label: string
  events: UpcomingEvent[]
  compact: boolean
}) {
  const visible = events.slice(0, BUCKET_CAP)
  const hidden = events.length - visible.length
  const byDay = groupEventsByKstDay(visible)
  return (
    <section>
      <div className="mb-4 flex items-center gap-4">
        <span className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
          {label}
        </span>
        <span className="bg-border h-px flex-1" />
      </div>
      <div className="space-y-5">
        {[...byDay.entries()].map(([dayKey, dayEvents]) => (
          <div key={dayKey}>
            <p className="text-muted-foreground/70 mb-1 font-mono text-[11px] tracking-[0.12em]">
              {dayLabel(dayEvents[0].start_at)}
            </p>
            <div className="space-y-3">
              {dayEvents.map((event) => (
                <HomeEventCard key={event.id} event={event} compact={compact} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <Link
          href={overflowHref(events[BUCKET_CAP])}
          className="text-muted-foreground hover:text-foreground mt-4 inline-block font-mono text-xs underline underline-offset-4"
        >
          + {hidden} more event{hidden > 1 ? 's' : ''} in {label.toLowerCase()}
        </Link>
      )}
    </section>
  )
}

export function Feed({ events }: { events: UpcomingEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="border-border/70 text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center text-sm">
        No more upcoming events from your groups.
      </div>
    )
  }

  const buckets = splitUpcomingByBuckets(events)
  const order: BucketKey[] = ['today', 'tomorrow', 'thisWeek', 'later']

  return (
    <div className="space-y-8">
      {order.map((key) => {
        const bucketEvents = buckets[key]
        if (bucketEvents.length === 0) return null
        return (
          <FeedSection
            key={key}
            label={BUCKET_LABELS[key]}
            events={bucketEvents}
            // `later` reste en compact (cartes plus denses) ; les 3 autres
            // buckets affichent la carte hero comme avant.
            compact={key === 'later'}
          />
        )
      })}
    </div>
  )
}
