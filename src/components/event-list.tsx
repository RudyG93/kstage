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
    return <p className="text-muted-foreground py-12 text-center text-sm">{emptyMessage}</p>
  }

  return (
    <ul className="space-y-3" aria-label="Events">
      {events.map((event) => (
        <li key={event.id}>
          <EventCard event={event} />
        </li>
      ))}
    </ul>
  )
}
