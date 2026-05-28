import Image from 'next/image'
import { Countdown } from './countdown'
import { TypeBadge } from './type-badge'
import { displayEventTitle } from '@/lib/events/title'
import type { UpcomingEvent } from '@/lib/events/queries'

export function NextDropCard({ event }: { event: UpcomingEvent | null }) {
  if (!event) return null
  const group = event.groups
  const title = displayEventTitle(event.title, group?.name)
  return (
    <div className="bg-card animate-in fade-in slide-in-from-bottom-2 ring-foreground/10 relative overflow-hidden rounded-2xl p-6 ring-1 duration-500">
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          background:
            'radial-gradient(ellipse at 30% 50%, #8b5cff 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, #ff2d87 0%, transparent 50%)',
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
          <p className="text-muted-foreground mt-1 font-mono text-xs tracking-[0.1em] uppercase">
            {group?.name}
          </p>
        </div>
        <div className="hidden shrink-0 sm:block">
          <Countdown targetIso={event.start_at} />
        </div>
      </div>
      <div className="border-border mt-4 border-t pt-4 sm:hidden">
        <Countdown targetIso={event.start_at} />
      </div>
    </div>
  )
}
