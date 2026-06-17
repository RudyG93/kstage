import Image from 'next/image'
import Link from 'next/link'
import { Countdown } from './countdown'
import { TypeBadge } from './type-badge'
import { displayEventTitle } from '@/lib/events/title'
import { eventHref, isExternalHref } from '@/lib/events/href'
import type { UpcomingEvent } from '@/lib/events/queries'
import type { Database } from '@/types/database'

// Libellé du compte à rebours selon le type de l'event (le « next drop » n'est
// pas toujours une release — ça pouvait afficher « until release » à tort).
const COUNTDOWN_LABEL: Partial<Record<Database['public']['Enums']['event_type'], string>> = {
  release: 'until release',
  mv: 'until premiere',
  music_show: 'until show',
  concert: 'until concert',
  live: 'until live',
  anniversary: 'until anniversary',
}

export function NextDropCard({ event }: { event: UpcomingEvent | null }) {
  if (!event) return null
  const group = event.groups
  const title = displayEventTitle(event.title, group?.name)
  const href = eventHref(event)
  const external = isExternalHref(href)
  const countdownLabel = COUNTDOWN_LABEL[event.type] ?? 'until drop'
  return (
    <Link
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="bg-card animate-in fade-in slide-in-from-bottom-2 border-border shadow-soft focus-visible:ring-primary/40 relative block overflow-hidden rounded-2xl border p-6 transition-shadow duration-500 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          background:
            'radial-gradient(ellipse at 30% 50%, var(--primary) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, var(--teal) 0%, transparent 50%)',
        }}
        aria-hidden
      />
      <div className="relative flex items-center gap-6">
        {group?.image_url ? (
          <Image
            src={group.image_url}
            alt={group.name}
            width={80}
            height={80}
            className="size-20 shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <div
            className="gradient-signature flex size-20 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white"
            aria-hidden
          >
            {group?.name?.[0] ?? '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <TypeBadge type={event.type} />
          <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-balance">
            {title}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">{group?.name}</p>
        </div>
        <div className="hidden shrink-0 sm:block">
          <Countdown targetIso={event.start_at} label={countdownLabel} />
        </div>
      </div>
      <div className="border-border mt-4 border-t pt-4 sm:hidden">
        <Countdown targetIso={event.start_at} />
      </div>
    </Link>
  )
}
