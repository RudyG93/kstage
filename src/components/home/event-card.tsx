import Image from 'next/image'
import Link from 'next/link'
import { LocalTime } from '@/components/local-time'
import { EVENT_TYPE_COLORS } from '@/lib/events/labels'
import { TypeBadge } from './type-badge'
import type { UpcomingEvent } from '@/lib/events/queries'

const kstFormat = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))

export function HomeEventCard({
  event,
  compact = false,
}: {
  event: UpcomingEvent
  compact?: boolean
}) {
  const group = event.groups
  const color = EVENT_TYPE_COLORS[event.type]
  const kst = kstFormat(event.start_at)

  if (compact) {
    return (
      <Link
        href={`/groups/${group?.slug ?? ''}`}
        className="hover:bg-muted/30 group -mx-3 flex h-14 items-center gap-3 rounded-xl px-3 transition-colors duration-200"
      >
        <div
          className="h-8 w-[3px] shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: group?.color_hex ?? '#888' }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{group?.name}</span>
            <TypeBadge type={event.type} />
          </div>
          <p className="text-muted-foreground truncate text-xs">{event.title}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm tabular-nums">{kst} KST</p>
          <p className="text-muted-foreground text-xs">
            <LocalTime iso={event.start_at} />
          </p>
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={`/groups/${group?.slug ?? ''}`}
      className="hover:bg-muted/30 hover:ring-foreground/5 group -mx-3 flex items-center gap-4 rounded-xl p-3 transition-all duration-200 hover:ring-1"
    >
      <div
        className="w-[3px] shrink-0 self-stretch rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {group?.image_url ? (
        <Image
          src={group.image_url}
          alt={group.name}
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div
          className="gradient-signature flex size-12 shrink-0 items-center justify-center rounded-xl font-semibold text-white"
          aria-hidden
        >
          {group?.name?.[0] ?? '?'}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{group?.name}</span>
          <TypeBadge type={event.type} />
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-sm">{event.title}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm tabular-nums">{kst} KST</p>
        <p className="text-muted-foreground text-xs">
          <LocalTime iso={event.start_at} />
        </p>
      </div>
    </Link>
  )
}
