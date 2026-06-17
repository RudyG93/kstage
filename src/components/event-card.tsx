import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { LocalTime } from '@/components/local-time'
import { EVENT_TYPE_LABELS } from '@/lib/events/labels'
import { displayEventTitle } from '@/lib/events/title'
import { eventHref, isExternalHref } from '@/lib/events/href'
import { formatKst } from '@/lib/events/date'
import type { UpcomingEvent } from '@/lib/events/queries'

/**
 * Carte d'event « compacte » : barre de couleur du groupe à gauche + dégradé,
 * date/heure KST à droite. Utilisée sur les pages secondaires (page groupe).
 * À distinguer de `home/event-card.tsx` (`HomeEventCard`) qui est la carte du
 * feed/calendrier : carré d'identité du groupe + heure KST + heure locale.
 */
export function EventCard({ event }: { event: UpcomingEvent }) {
  const group = event.groups
  const color = group?.color_hex ?? '#7c5cff'
  const isAnniversary = event.type === 'anniversary'

  const dateLabel = formatKst(event.start_at, { month: 'short', day: '2-digit' }).toUpperCase()
  const timeLabel = formatKst(event.start_at, { hour: 'numeric', minute: '2-digit' })

  const href = eventHref(event)
  const external = isExternalHref(href)

  return (
    <Link
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="group/event bg-card hover:border-primary/40 focus-visible:ring-primary/40 relative flex items-stretch gap-3.5 overflow-hidden rounded-xl border pr-4 pl-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {/* barre couleur du groupe + teinte permanente + halo renforcé au survol (touche de B) */}
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(90deg, ${color}1f, transparent 44%)` }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/event:opacity-100"
        style={{
          background: `radial-gradient(130% 140% at 0% 0%, ${color}33, transparent 60%)`,
        }}
        aria-hidden
      />

      <div className="min-w-0 flex-1 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{group?.name}</span>
          <span
            className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider uppercase"
            style={{ color, backgroundColor: `${color}24` }}
          >
            {EVENT_TYPE_LABELS[event.type]}
          </span>
          {event.status === 'tentative' && (
            <span className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
              · tentative
            </span>
          )}
          {external && (
            <span className="text-faint inline-flex items-center" title="Opens an external site">
              <ExternalLink className="size-3" aria-hidden />
              <span className="sr-only">opens an external site</span>
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-[13px]">
          {displayEventTitle(event.title, group?.name, event.episode_number)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-center py-3 text-right">
        <span className="font-mono text-sm font-semibold tracking-tight tabular-nums">
          {dateLabel}
        </span>
        {!isAnniversary && (
          <>
            <span className="text-muted-foreground mt-0.5 font-mono text-[11px] tabular-nums">
              {timeLabel} KST
            </span>
            <span className="text-muted-foreground/70 font-mono text-[10px]">
              <LocalTime iso={event.start_at} />
            </span>
          </>
        )}
      </div>
    </Link>
  )
}
