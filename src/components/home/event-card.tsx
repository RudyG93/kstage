import Image from 'next/image'
import Link from 'next/link'
import { LocalTime } from '@/components/local-time'
import { faceCrop } from '@/lib/images/cloudinary'
import { TypeBadge } from './type-badge'
import type { UpcomingEvent } from '@/lib/events/queries'

const kstFormat = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))

// Fondu latéral : l'image s'estompe sur ses bords pour se fondre entre le texte
// (gauche) et l'horaire (droite). En style inline (fiable sans Tailwind JIT).
const CENTER_FADE = 'linear-gradient(to right, transparent, #000 25%, #000 75%, transparent)'

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
      className={`group hover:bg-muted/30 flex items-center gap-3 overflow-hidden rounded-xl px-3 transition-colors duration-200 ${compact ? 'h-14' : 'h-16'}`}
    >
      <div className="max-w-[55%] min-w-0 shrink">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{group?.name}</span>
          <TypeBadge type={event.type} />
        </div>
        <p className="text-muted-foreground truncate text-xs">{event.title}</p>
      </div>

      {/* colonne centrale : image du groupe en fondu, format ~4:3 centré (plus
          étroit que le gap → on voit têtes + épaules sans sur-recadrage) */}
      <div className="flex h-full flex-1 items-center justify-center">
        {group?.image_url && (
          <div className="relative h-full" style={{ aspectRatio: '4 / 3' }}>
            <Image
              src={faceCrop(group.image_url, 320, 240)}
              alt=""
              aria-hidden
              fill
              unoptimized
              sizes="160px"
              className="pointer-events-none object-cover object-center opacity-25 select-none"
              style={{ maskImage: CENTER_FADE, WebkitMaskImage: CENTER_FADE }}
            />
          </div>
        )}
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
