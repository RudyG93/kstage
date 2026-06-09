import Image from 'next/image'
import Link from 'next/link'
import { LocalTime } from '@/components/local-time'
import { CountdownBadge } from './countdown'
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/lib/events/labels'
import { displayEventTitle } from '@/lib/events/title'
import { eventHref, isExternalHref } from '@/lib/events/href'
import { faceCrop } from '@/lib/images/cloudinary'
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
  const kst = kstFormat(event.start_at)
  const typeColor = EVENT_TYPE_COLORS[event.type]
  const displayTitle = displayEventTitle(event.title, group?.name, event.episode_number)

  // Countdown FOMO (§5) sur les comebacks (mv/release). Le CountdownBadge gère
  // lui-même la fenêtre temporelle (< 14 j, futur) et ne rend rien sinon, pour
  // garder ce server component pur (pas de Date.now dans le render).
  const isComeback = event.type === 'mv' || event.type === 'release'

  // Image de fond plein cover (banner_url admin prioritaire, sinon Deezer
  // recadré visage Cloudinary). Le texte 3 lignes est posé dessus, lisible
  // grâce au scrim sombre.
  const bannerSrc =
    group?.banner_url ?? (group?.image_url ? faceCrop(group.image_url, 1600, 400) : null)

  const href = eventHref(event)
  const external = isExternalHref(href)

  return (
    <Link
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`group relative block overflow-hidden rounded-xl ${compact ? 'h-20' : 'h-28'}`}
    >
      {bannerSrc ? (
        <Image
          src={bannerSrc}
          alt=""
          aria-hidden
          fill
          unoptimized
          sizes="(min-width: 1024px) 1000px, 320px"
          className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="gradient-signature absolute inset-0" aria-hidden />
      )}

      {/* scrim pour la lisibilité du texte par-dessus l'image */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20"
        aria-hidden
      />
      {/* accent couleur du type d'event */}
      <div
        className="absolute top-0 left-0 h-full w-1"
        style={{ backgroundColor: typeColor }}
        aria-hidden
      />

      <div className="relative flex h-full items-center justify-between gap-3 py-2 pr-4 pl-5">
        <div className="min-w-0 flex-1 space-y-1">
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase"
            style={{ backgroundColor: typeColor }}
          >
            {EVENT_TYPE_LABELS[event.type]}
          </span>
          <p className="truncate text-sm leading-tight font-semibold text-white">{group?.name}</p>
          <p className="truncate text-xs text-white/80">{displayTitle}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <p className="font-mono text-sm font-medium text-white tabular-nums">
            <LocalTime iso={event.start_at} />
          </p>
          <p className="font-mono text-[11px] text-white/70 tabular-nums">{kst} KST</p>
          {isComeback && <CountdownBadge targetIso={event.start_at} />}
        </div>
      </div>
    </Link>
  )
}
