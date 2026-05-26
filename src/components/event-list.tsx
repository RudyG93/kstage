import { EventCard } from '@/components/event-card'
import type { UpcomingEvent } from '@/lib/events/queries'

export function EventList({
  events,
  emptyMessage = 'No upcoming events.',
}: {
  events: UpcomingEvent[]
  emptyMessage?: string
}) {
  if (events.length === 0) {
    return (
      <div className="border-border/70 text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center text-sm">
        {emptyMessage}
      </div>
    )
  }

  return (
    <ul className="space-y-2.5" aria-label="Events">
      {events.map((event) => (
        <li key={event.id}>
          <EventCard event={event} />
        </li>
      ))}
    </ul>
  )
}
