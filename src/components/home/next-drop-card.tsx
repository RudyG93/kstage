import Image from 'next/image'
import Link from 'next/link'
import { Countdown } from './countdown'
import { NotifyCta } from './notify-cta'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { displayEventTitle } from '@/lib/events/title'
import { eventHref, isExternalHref } from '@/lib/events/href'
import { formatDDay, formatKst, kstTime24h } from '@/lib/events/date'
import { EVENT_TYPE_LABELS } from '@/lib/events/labels'
import { LocalTime } from '@/components/local-time'
import type { UpcomingEvent } from '@/lib/events/queries'

// Hero « NEXT UP » : photo du groupe en fond (banner/landscape) + scrim de
// marque pour la lisibilité, border-left primary, tags GROUP + D-day,
// countdown 4 cellules, CTA notify.
export function NextDropCard({
  event,
  isFollowing = false,
  isAuthed = false,
  latestMvImage = null,
}: {
  event: UpcomingEvent | null
  isFollowing?: boolean
  isAuthed?: boolean
  // Thumbnail maxres du dernier MV du groupe : le visuel le plus FRAIS
  // disponible (les fanarts TheAudioDB datent — aespa servait un backdrop 2021).
  latestMvImage?: string | null
}) {
  if (!event) return null
  const group = event.groups
  const title = displayEventTitle(event.title, group?.name)
  const href = eventHref(event)
  const external = isExternalHref(href)
  const hex = group?.color_hex ?? 'var(--primary)'
  // Fond : banner admin > thumbnail du dernier MV (ère en cours) > landscape ;
  // repli gradient de marque seul quand rien n'existe.
  const bgImage = group?.banner_url ?? latestMvImage ?? group?.image_landscape ?? null
  // Scrim : opaque côté texte → transparent côté image, teinté par la marque.
  const gradient = bgImage
    ? `linear-gradient(100deg, var(--card) 0%, color-mix(in srgb, var(--card) 82%, ${group?.color_hex ?? 'transparent'}) 42%, color-mix(in srgb, var(--card) 30%, transparent) 78%, transparent 100%)`
    : group?.color_hex
      ? `linear-gradient(115deg, ${hex}47 0%, ${hex}1a 55%, transparent 75%)`
      : `linear-gradient(115deg, color-mix(in srgb, var(--primary) 28%, transparent), transparent 75%)`
  const dateLabel = formatKst(event.start_at, { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <Panel className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <PanelHeader label="Next up — your groups" action={{ label: 'All', href: '/calendar' }} />
      <div className="border-primary relative overflow-hidden border-l-[3px]">
        {bgImage && (
          <Image
            src={bgImage}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 1024px) 640px, 100vw"
            className="object-cover object-[70%_30%]"
            aria-hidden
          />
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: gradient }}
          aria-hidden
        />
        <div className="relative space-y-3 p-3.5">
          <div className="flex items-start gap-3">
            {group?.image_url ? (
              <Image
                src={group.image_url}
                alt={group.name}
                width={62}
                height={62}
                className="size-[62px] shrink-0 rounded-[10px] object-cover"
              />
            ) : (
              <div
                className="gradient-signature flex size-[62px] shrink-0 items-center justify-center rounded-[10px] text-xl font-bold text-white"
                aria-hidden
              >
                {group?.name?.[0] ?? '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="label-data-inline bg-page/50 rounded-[4px] px-1.5 py-0.5 text-[8.5px] backdrop-blur-sm">
                  {EVENT_TYPE_LABELS[event.type]}
                </span>
                <span className="label-data-inline bg-page/50 text-primary rounded-[4px] px-1.5 py-0.5 text-[8.5px] backdrop-blur-sm">
                  {formatDDay(event.start_at, 'Asia/Seoul')}
                </span>
              </div>
              <h2 className="font-heading mt-1.5 text-xl leading-tight font-extrabold tracking-[-0.02em] text-balance">
                <Link
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="hover:text-primary focus-visible:ring-primary/40 rounded transition-colors outline-none focus-visible:ring-2"
                >
                  {title}
                </Link>
              </h2>
              <p className="text-muted-foreground mt-0.5 text-[10.5px] font-medium">
                {group?.name && <span>{group.name} · </span>}
                {dateLabel} · {kstTime24h(event.start_at)} KST ·{' '}
                <LocalTime iso={event.start_at} withZone={false} fallback="—" /> local
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <Countdown targetIso={event.start_at} variant="cells" />
            {event.group_id && (
              <NotifyCta
                groupId={event.group_id}
                initialFollowing={isFollowing}
                isAuthed={isAuthed}
              />
            )}
          </div>
        </div>
      </div>
    </Panel>
  )
}
