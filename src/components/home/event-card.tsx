import Image from 'next/image'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { LocalTime } from '@/components/local-time'
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/lib/events/labels'
import { displaySongTitle } from '@/lib/events/title'
import { eventHref, isExternalHref } from '@/lib/events/href'
import type { UpcomingEvent } from '@/lib/events/queries'

// Heure KST en 24 h (« 18:00 ») — la référence k-pop, mise en avant ; l'heure
// locale du visiteur est rendue en second (client) via <LocalTime>.
const kstFormat = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))

/**
 * Carte d'event du feed/calendrier — design « Daylight/Midnight » (handoff) :
 * carte claire, carré d'identité du groupe à gauche, titre + pastille de type,
 * heure KST alignée à droite. Remplace l'ancienne bannière plein-cadre à scrim.
 */
export function HomeEventCard({
  event,
  compact = false,
}: {
  event: UpcomingEvent
  compact?: boolean
}) {
  const group = event.groups
  const typeColor = EVENT_TYPE_COLORS[event.type]
  const songTitle = displaySongTitle(event.title, group?.name)
  // Carré d'identité : teinté à la couleur du groupe (comme les maquettes).
  const squareColor = group?.color_hex ?? typeColor
  const allDay = event.type === 'anniversary'

  const href = eventHref(event)
  const external = isExternalHref(href)

  return (
    <Link
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`group bg-card border-border shadow-soft focus-visible:ring-primary/40 flex items-center gap-3.5 rounded-lg border transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:outline-none ${
        compact ? 'px-3.5 py-2.5' : 'px-4 py-3'
      }`}
    >
      {group?.image_url ? (
        <Image
          src={group.image_url}
          alt=""
          aria-hidden
          width={40}
          height={40}
          className="size-9 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-bold"
          style={{ backgroundColor: `${squareColor}24`, color: squareColor }}
          aria-hidden
        >
          {group?.name?.[0] ?? '?'}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{songTitle}</span>
          <span
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color: typeColor, backgroundColor: `${typeColor}24` }}
          >
            {EVENT_TYPE_LABELS[event.type]}
          </span>
          {external && (
            <>
              <ExternalLink className="text-faint size-3 shrink-0" aria-hidden />
              <span className="sr-only">opens an external site</span>
            </>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">{group?.name}</p>
      </div>

      <div className="shrink-0 text-right">
        {allDay ? (
          <div className="text-muted-foreground text-sm font-medium">All day</div>
        ) : (
          <>
            <div className="tabular text-[15px] font-semibold tabular-nums">
              {kstFormat(event.start_at)}
            </div>
            <div className="text-faint font-mono text-[10px]">
              KST · <LocalTime iso={event.start_at} /> local
            </div>
          </>
        )}
      </div>
    </Link>
  )
}
