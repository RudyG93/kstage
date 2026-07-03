import Link from 'next/link'
import Image from 'next/image'
import { Countdown } from '@/components/home/countdown'
import { formatDDay, kstTime24h } from '@/lib/events/date'
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/lib/events/labels'
import { displayEventTitle } from '@/lib/events/title'
import { eventHref, isExternalHref } from '@/lib/events/href'
import { faceCrop } from '@/lib/images/cloudinary'
import type { UpcomingEvent } from '@/lib/events/queries'

// Ligne dense de queue (Data Desk §7.1.4) : border-left couleur type, colonne
// D-day, tag type, titre + sous-titre, heure KST. Partagée par home, calendar,
// fiche groupe et search. Hauteur de contenu 40px + padding → hit ≥44px.
export function QueueRow({
  event,
  timeZone = 'Asia/Seoul',
  showThumb = false,
  withCountdown = false,
}: {
  event: UpcomingEvent
  timeZone?: string
  showThumb?: boolean
  // Countdown inline « in 07:22:14 » (teal) pour les events du soir (§7.2).
  withCountdown?: boolean
}) {
  const color = EVENT_TYPE_COLORS[event.type]
  const group = event.groups
  const href = eventHref(event)
  const external = isExternalHref(href)
  const dday = formatDDay(event.start_at, timeZone)

  return (
    <Link
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="hover:bg-secondary/60 focus-visible:ring-primary/40 flex min-h-[44px] items-center gap-2.5 border-l-2 py-1.5 pr-3 pl-2.5 transition-colors outline-none focus-visible:ring-2"
      style={{ borderLeftColor: color }}
    >
      <span className="tabular w-[38px] shrink-0 text-xs font-bold" style={{ color }}>
        {dday}
      </span>
      {showThumb &&
        (group?.image_url ? (
          <Image
            src={faceCrop(group.image_url, 80, 80)}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="size-10 shrink-0 rounded-[7px] object-cover"
            aria-hidden
          />
        ) : (
          <span
            className="gradient-signature flex size-10 shrink-0 items-center justify-center rounded-[7px] text-sm font-bold text-white"
            aria-hidden
          >
            {group?.name?.[0] ?? '?'}
          </span>
        ))}
      <span
        className="label-data-inline shrink-0 rounded-[6px] px-1.5 py-1 text-[8px]"
        style={{ color, backgroundColor: `${color}1f` }}
      >
        {EVENT_TYPE_LABELS[event.type]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">
          {displayEventTitle(event.title, group?.name, event.episode_number)}
        </span>
        {group?.name && (
          <span className="text-muted-foreground block truncate text-[10px]">{group.name}</span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="tabular text-muted-foreground text-[10px]">
          {kstTime24h(event.start_at)} KST
        </span>
        {withCountdown && dday === 'D-DAY' && (
          <Countdown targetIso={event.start_at} variant="inline" />
        )}
      </span>
    </Link>
  )
}
