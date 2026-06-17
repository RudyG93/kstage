import Image from 'next/image'
import Link from 'next/link'
import { Countdown } from './countdown'
import { TypeBadge } from './type-badge'
import { FollowButton } from '@/components/follow-button'
import { displayEventTitle } from '@/lib/events/title'
import { eventHref, isExternalHref } from '@/lib/events/href'
import type { UpcomingEvent } from '@/lib/events/queries'

export function NextDropCard({
  event,
  isFollowing = false,
  isAuthed = false,
}: {
  event: UpcomingEvent | null
  isFollowing?: boolean
  isAuthed?: boolean
}) {
  if (!event) return null
  const group = event.groups
  const title = displayEventTitle(event.title, group?.name)
  const href = eventHref(event)
  const external = isExternalHref(href)

  return (
    <section className="bg-card animate-in fade-in slide-in-from-bottom-2 border-border shadow-soft relative overflow-hidden rounded-2xl border p-6 duration-500">
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          background:
            'radial-gradient(ellipse at 30% 50%, var(--primary) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, var(--teal) 0%, transparent 50%)',
        }}
        aria-hidden
      />
      <div className="relative flex items-center gap-5">
        {group?.image_url ? (
          <Image
            src={group.image_url}
            alt={group.name}
            width={72}
            height={72}
            className="size-16 shrink-0 rounded-2xl object-cover sm:size-18"
          />
        ) : (
          <div
            className="gradient-signature flex size-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white sm:size-18"
            aria-hidden
          >
            {group?.name?.[0] ?? '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <TypeBadge type={event.type} />
          <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-balance">
            <Link
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="hover:text-primary focus-visible:ring-primary/40 rounded transition-colors outline-none focus-visible:ring-2"
            >
              {title}
            </Link>
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">{group?.name}</p>
        </div>
      </div>

      {/* Compteur + suivi (maquette : séparateur, puis chiffres à gauche, bouton à droite) */}
      <div className="border-border relative mt-5 flex flex-wrap items-center gap-4 border-t pt-5">
        <Countdown targetIso={event.start_at} />
        {event.group_id && (
          <FollowButton
            groupId={event.group_id}
            initialFollowing={isFollowing}
            isAuthed={isAuthed}
            className="ml-auto"
          />
        )}
      </div>
    </section>
  )
}
