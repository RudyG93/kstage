import Image from 'next/image'
import Link from 'next/link'
import { FollowButton } from '@/components/follow-button'
import { faceCrop } from '@/lib/images/cloudinary'
import { formatDDay } from '@/lib/events/date'
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/lib/events/labels'
import type { GroupSummary } from '@/lib/groups/queries'
import type { Database } from '@/types/database'

export type NextEventInfo = {
  type: Database['public']['Enums']['event_type']
  start_at: string
  title: string
}

/**
 * Tuile groupe carrée Data Desk (§7.5) : photo + scrim vers --page, nom
 * Bricolage 15/800, ligne statut (dot type + « COMEBACK D-2 »), cœur 28px.
 * `href` optionnel pointe `/artists/[memberSlug]` côté tab Solo.
 */
export function GroupCard({
  group,
  isFollowing,
  isAuthed,
  timeZone,
  href,
  nextEvent,
}: {
  group: GroupSummary
  isFollowing: boolean
  isAuthed: boolean
  timeZone: string
  href?: string
  nextEvent?: NextEventInfo | null
}) {
  const img = group.image_url ? faceCrop(group.image_url, 600, 600) : null
  const statusColor = nextEvent ? EVENT_TYPE_COLORS[nextEvent.type] : null
  const statusLabel = nextEvent
    ? nextEvent.type === 'mv' || nextEvent.type === 'release'
      ? `COMEBACK ${formatDDay(nextEvent.start_at, timeZone)}`
      : `${EVENT_TYPE_LABELS[nextEvent.type].toUpperCase()} ${formatDDay(nextEvent.start_at, timeZone)}`
    : null

  return (
    <div className="group hover:border-border relative aspect-square overflow-hidden rounded-xl border transition">
      {img ? (
        <Image
          src={img}
          alt=""
          aria-hidden
          fill
          unoptimized
          sizes="(min-width: 768px) 320px, 50vw"
          className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-3xl font-bold text-white"
          style={
            group.color_hex
              ? { background: `linear-gradient(150deg, ${group.color_hex}, ${group.color_hex}55)` }
              : undefined
          }
          aria-hidden
        >
          {!group.color_hex && <span className="gradient-signature absolute inset-0" aria-hidden />}
          <span className="font-heading relative">{group.name[0]}</span>
        </div>
      )}

      {/* Scrim bas vers --page (§7.5). */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, transparent 45%, color-mix(in srgb, var(--page) 85%, transparent))',
        }}
        aria-hidden
      />

      {/* zone cliquable plein cadre (sous le cœur) */}
      <Link
        href={href ?? `/groups/${group.slug}`}
        aria-label={group.name}
        className="focus-visible:ring-ring/60 absolute inset-0 rounded-xl outline-none focus-visible:ring-2"
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2.5">
        <p
          className="font-heading truncate text-[15px] font-extrabold"
          style={{ textShadow: '0 2px 16px color-mix(in srgb, var(--page) 50%, transparent)' }}
        >
          {group.name}
        </p>
        {statusLabel && statusColor && (
          <p className="mt-0.5 flex items-center gap-1.5">
            <span
              className="size-[4px] shrink-0 rounded-full"
              style={{ backgroundColor: statusColor }}
              aria-hidden
            />
            <span className="tabular text-[9.5px] font-semibold" style={{ color: statusColor }}>
              {statusLabel}
            </span>
          </p>
        )}
      </div>

      <div className="absolute top-2 right-2 z-10">
        <FollowButton
          groupId={group.id}
          initialFollowing={isFollowing}
          isAuthed={isAuthed}
          iconOnly
        />
      </div>
    </div>
  )
}
