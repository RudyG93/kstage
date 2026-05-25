import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { LocalTime } from '@/components/local-time'
import { formatEventDate } from '@/lib/events/date'
import { EVENT_TYPE_LABELS } from '@/lib/events/labels'
import type { UpcomingEvent } from '@/lib/events/queries'

export function EventCard({ event }: { event: UpcomingEvent }) {
  const group = event.groups
  return (
    <Card size="sm" className="px-3">
      <div className="flex items-start gap-3">
        <span
          className="mt-1.5 size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: group?.color_hex ?? 'var(--muted-foreground)' }}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{group?.name}</span>
            <Badge variant="secondary">{EVENT_TYPE_LABELS[event.type]}</Badge>
          </div>
          <p className="text-sm">{event.title}</p>
          <p className="text-muted-foreground text-xs">
            {formatEventDate(event.start_at, 'Asia/Seoul')} KST
            <LocalTime iso={event.start_at} />
          </p>
        </div>
      </div>
    </Card>
  )
}
