import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/lib/events/labels'
import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

export function TypeBadge({ type }: { type: EventType }) {
  const color = EVENT_TYPE_COLORS[type]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: `${color}20`, color }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {EVENT_TYPE_LABELS[type]}
    </span>
  )
}
