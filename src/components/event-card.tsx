import { LocalTime } from '@/components/local-time'
import { EVENT_TYPE_LABELS } from '@/lib/events/labels'
import type { UpcomingEvent } from '@/lib/events/queries'

const kstFormat = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', ...opts }).format(new Date(iso))

export function EventCard({ event }: { event: UpcomingEvent }) {
  const group = event.groups
  const color = group?.color_hex ?? '#7c5cff'
  const isAnniversary = event.type === 'anniversary'

  const dateLabel = kstFormat(event.start_at, { month: 'short', day: '2-digit' }).toUpperCase()
  const timeLabel = kstFormat(event.start_at, { hour: 'numeric', minute: '2-digit' })

  return (
    <article className="group/event bg-card hover:border-primary/40 relative flex items-stretch gap-3.5 overflow-hidden rounded-xl border pr-4 pl-4 transition-colors">
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
        </div>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-[13px]">{event.title}</p>
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
    </article>
  )
}
