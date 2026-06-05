import { EventCard } from '@/components/event-card'
import type { UpcomingEvent } from '@/lib/events/queries'

export function EventList({
  events,
  emptyMessage = 'No upcoming events.',
  scrollAfter,
}: {
  events: UpcomingEvent[]
  emptyMessage?: string
  // Au-delà de `scrollAfter` events, la liste passe en zone scrollable verticale
  // (§6.1) — montre ~5 events, le reste se déroule sans allonger la page.
  scrollAfter?: number
}) {
  if (events.length === 0) {
    return (
      <div className="border-border/70 text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center text-sm">
        {emptyMessage}
      </div>
    )
  }

  const list = (
    <ul className="space-y-2.5" aria-label="Events">
      {events.map((event) => (
        <li key={event.id}>
          <EventCard event={event} />
        </li>
      ))}
    </ul>
  )

  if (scrollAfter && events.length > scrollAfter) {
    return <div className="max-h-[420px] overflow-y-auto pr-1">{list}</div>
  }
  return list
}
