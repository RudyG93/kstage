import Image from 'next/image'
import Link from 'next/link'
import { LocalTime } from '@/components/local-time'
import { TypeBadge } from './type-badge'
import type { UpcomingEvent } from '@/lib/events/queries'

const kstFormat = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))

// Masque latéral : l'image n'est visible qu'au centre, en fondu, pour ne pas
// gêner le texte (gauche) ni l'horaire (droite). En style inline (fiable, sans
// dépendre de l'extraction Tailwind des valeurs arbitraires).
const CENTER_FADE = 'linear-gradient(to right, transparent, #000 35%, #000 70%, transparent)'

export function HomeEventCard({
  event,
  compact = false,
}: {
  event: UpcomingEvent
  compact?: boolean
}) {
  const group = event.groups
  const kst = kstFormat(event.start_at)

  return (
    <Link
      href={`/groups/${group?.slug ?? ''}`}
      className={`group hover:bg-muted/30 relative -mx-3 flex items-center gap-3 overflow-hidden rounded-xl px-3 transition-colors duration-200 ${compact ? 'h-14' : 'h-16'}`}
    >
      {group?.image_url && (
        <Image
          src={group.image_url}
          alt=""
          aria-hidden
          fill
          sizes="(max-width: 1024px) 100vw, 640px"
          className="pointer-events-none object-cover object-center opacity-25 select-none"
          style={{ maskImage: CENTER_FADE, WebkitMaskImage: CENTER_FADE }}
        />
      )}

      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{group?.name}</span>
          <TypeBadge type={event.type} />
        </div>
        <p className="text-muted-foreground truncate text-xs">{event.title}</p>
      </div>

      <div className="relative z-10 shrink-0 pl-3 text-right">
        <p className="font-mono text-sm tabular-nums">{kst} KST</p>
        <p className="text-muted-foreground text-xs">
          <LocalTime iso={event.start_at} />
        </p>
      </div>
    </Link>
  )
}
