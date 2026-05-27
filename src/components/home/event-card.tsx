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
  // backdrop : image paysage (TheAudioDB) si dispo, sinon le carré Deezer —
  // dans les deux cas recadré sur le visage par Cloudinary g_auto (sinon un
  // object-cover centré tombe sur les torses).
  const rawImage = group?.image_landscape ?? group?.image_url ?? null
  const bannerSrc = rawImage ? faceCrop(rawImage, 400, 220) : null

  return (
    <Link
      href={`/groups/${group?.slug ?? ''}`}
      className={`group hover:bg-muted/30 flex items-center gap-3 overflow-hidden rounded-xl px-3 transition-colors duration-200 ${compact ? 'h-16' : 'h-20'}`}
    >
      <div className="max-w-[42%] min-w-0 shrink">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{group?.name}</span>
          <TypeBadge type={event.type} />
        </div>
        <p className="text-muted-foreground truncate text-xs">{event.title}</p>
      </div>

      {/* image du groupe, remplit l'espace central en fondu (recadrée visage par
          Cloudinary). Bandeau plus haut → on en voit davantage. */}
      <div className="relative h-full flex-1">
        {bannerSrc && (
          <Image
            src={bannerSrc}
            alt=""
            aria-hidden
            fill
            unoptimized
            sizes="(max-width: 1024px) 50vw, 360px"
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
