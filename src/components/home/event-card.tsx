import Image from 'next/image'
import Link from 'next/link'
import { LocalTime } from '@/components/local-time'
import { EVENT_TYPE_COLORS } from '@/lib/events/labels'
import { displayEventTitle } from '@/lib/events/title'
import { eventHref } from '@/lib/events/href'
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
const CENTER_FADE = 'linear-gradient(to right, transparent, #000 30%, #000 70%, transparent)'

export function HomeEventCard({
  event,
  compact = false,
}: {
  event: UpcomingEvent
  compact?: boolean
}) {
  const group = event.groups
  const kst = kstFormat(event.start_at)
  const typeColor = EVENT_TYPE_COLORS[event.type]
  const displayTitle = displayEventTitle(event.title, group?.name)

  // backdrop : recadrage manuel admin (banner_url) en priorité ; sinon Deezer
  // (image_url) recadré visage Cloudinary en 8:1 — même format que le cropper
  // admin (WYSIWYG). L'image remplit toute la colonne flex-1 via object-cover.
  const bannerSrc =
    group?.banner_url ?? (group?.image_url ? faceCrop(group.image_url, 1600, 200) : null)

  return (
    <Link
      href={eventHref(event)}
      className={`group hover:bg-muted/30 flex items-center gap-3 overflow-hidden rounded-xl px-3 transition-colors duration-200 ${compact ? 'h-16' : 'h-20'}`}
    >
      <div
        className="h-10 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: typeColor }}
        aria-hidden
      />

      <div className="w-40 max-w-[50%] shrink-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{group?.name}</span>
          <TypeBadge type={event.type} />
        </div>
        <p className="text-muted-foreground truncate text-xs">{displayTitle}</p>
      </div>

      {/* image du groupe en full-bleed sur toute la colonne flex-1 ; les bords
          gauche/droite sont masqués par le fondu CENTER_FADE pour atténuer le
          décalage de cadrage entre le cropper (8:1 fixe) et le rendu réel
          (ratio variable selon la viewport). */}
      <div className="relative h-full flex-1">
        {bannerSrc && (
          <Image
            src={bannerSrc}
            alt=""
            aria-hidden
            fill
            unoptimized
            sizes="(min-width: 1024px) 1000px, 320px"
            className="pointer-events-none object-cover object-center opacity-40 select-none"
            style={{ maskImage: CENTER_FADE, WebkitMaskImage: CENTER_FADE }}
          />
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
