import Image from 'next/image'
import Link from 'next/link'
import { LocalTime } from '@/components/local-time'
import { EVENT_TYPE_COLORS } from '@/lib/events/labels'
import { faceCrop } from '@/lib/images/cloudinary'
import { TypeBadge } from './type-badge'
import type { UpcomingEvent } from '@/lib/events/queries'

const kstFormat = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))

// Le nom du groupe est déjà affiché à gauche du bandeau — si un titre scrapé
// le répète (ex. "aespa - Whiplash MV", "ATEEZ Album - Golden Hour"), on le
// retire jusqu'au premier séparateur pour ne pas perdre de place.
function stripGroupPrefix(title: string, groupName?: string | null): string {
  if (!groupName) return title
  const escaped = groupName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return title.replace(new RegExp(`^${escaped}(?:\\s+\\w+)*\\s*[—\\-:]\\s*`, 'i'), '')
}

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
  const displayTitle = stripGroupPrefix(event.title, group?.name)

  // backdrop : recadrage manuel admin (banner_url, déjà au bon format) en
  // priorité ; sinon Deezer (image_url) recadré visage Cloudinary en 4:1 —
  // identique au cropper admin (WYSIWYG, sans re-crop par object-cover).
  const bannerSrc =
    group?.banner_url ?? (group?.image_url ? faceCrop(group.image_url, 800, 200) : null)

  return (
    <Link
      href={`/groups/${group?.slug ?? ''}`}
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

      {/* image du groupe, format fixe 4:1 centré dans l'espace dispo (= aspect
          du cropper admin → WYSIWYG, l'object-cover ne re-recadre pas). */}
      <div className="flex h-full flex-1 items-center justify-center">
        {bannerSrc && (
          <div className="relative h-full" style={{ aspectRatio: '4 / 1' }}>
            <Image
              src={bannerSrc}
              alt=""
              aria-hidden
              fill
              unoptimized
              sizes="320px"
              className="pointer-events-none object-cover object-center opacity-40 select-none"
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
