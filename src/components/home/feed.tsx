import { splitUpcomingByWeek } from '@/lib/events/grouping'
import { groupEventsByKstDay } from '@/lib/events/date'
import { HomeEventCard } from './event-card'
import type { UpcomingEvent } from '@/lib/events/queries'

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

function FeedSection({
  label,
  events,
  compact,
}: {
  label: string
  events: UpcomingEvent[]
  compact: boolean
}) {
  const byDay = groupEventsByKstDay(events)
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
            <div className="space-y-0.5">
              {dayEvents.map((event) => (
                <HomeEventCard key={event.id} event={event} compact={compact} />
              ))}
            </div>
          </div>
        ))}
      </div>
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

  const { thisWeek, later } = splitUpcomingByWeek(events)

  return (
    <div className="space-y-8">
      {thisWeek.length > 0 && <FeedSection label="This week" events={thisWeek} compact={false} />}
      {later.length > 0 && <FeedSection label="Later" events={later} compact={true} />}
    </div>
  )
}
