import { EventCard } from '@/components/event-card'
import { splitUpcomingByWeek } from '@/lib/events/grouping'
import type { UpcomingEvent } from '@/lib/events/queries'

function Section({ label, events }: { label: string; events: UpcomingEvent[] }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground font-mono text-[11px] tracking-[0.16em] uppercase">
          {label}
        </span>
        <span className="bg-border h-px flex-1" />
      </div>
      <ul className="space-y-2.5">
        {events.map((event) => (
          <li key={event.id}>
            <EventCard event={event} />
          </li>
        ))}
      </ul>
    </section>
  )
}

// Liste d'events groupée en « This week » / « Later » (les events arrivent triés
// par start_at croissant). Démarque l'app d'une longue liste plate.
export function GroupedEventList({
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

  const { thisWeek, later } = splitUpcomingByWeek(events)

  return (
    <div className="space-y-7">
      {thisWeek.length > 0 && <Section label="This week" events={thisWeek} />}
      {later.length > 0 && <Section label="Later" events={later} />}
    </div>
  )
}
