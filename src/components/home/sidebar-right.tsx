import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Star, Lightbulb } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getRecentComebacks } from '@/lib/events/queries'
import { displaySongTitle } from '@/lib/events/title'
import { eventHref } from '@/lib/events/href'
import { getPendingSuggestionsCount } from '@/lib/suggestions/queries'
import {
  MOCK_MV_OF_THE_MONTH,
  MOCK_RELEASE_OF_THE_MONTH,
  MOCK_RECENT_ACTIVITY,
} from '@/lib/mocks/home'

function formatVotes(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
      {children}
    </span>
  )
}

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Seoul' })
    .format(new Date(iso))
    .toUpperCase()

export async function SidebarRight() {
  const [recentComebacks, pendingCount] = await Promise.all([
    getRecentComebacks(10),
    getPendingSuggestionsCount(),
  ])

  return (
    <div className="space-y-4 lg:sticky lg:top-20">
      {/* MV of the month — mock V2 (ratings) */}
      <article className="bg-card ring-foreground/10 overflow-hidden rounded-2xl ring-1">
        <div className="relative aspect-video">
          <Image
            src={MOCK_MV_OF_THE_MONTH.thumbnailUrl}
            alt={`${MOCK_MV_OF_THE_MONTH.groupName} — ${MOCK_MV_OF_THE_MONTH.title}`}
            fill
            className="object-cover"
            sizes="320px"
          />
          <span className="gradient-signature absolute top-3 left-3 rounded-md px-2 py-1 text-[10px] font-bold tracking-wider text-white uppercase">
            MV of the month
          </span>
        </div>
        <div className="p-4">
          <h3 className="font-heading text-lg font-bold">{MOCK_MV_OF_THE_MONTH.title}</h3>
          <p className="text-muted-foreground font-mono text-xs uppercase">
            {MOCK_MV_OF_THE_MONTH.groupName}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Star className="size-4 fill-yellow-500 text-yellow-500" aria-hidden />
            <span className="text-2xl font-bold tabular-nums">{MOCK_MV_OF_THE_MONTH.rating}</span>
            <span className="text-muted-foreground font-mono text-sm">
              {formatVotes(MOCK_MV_OF_THE_MONTH.votes)} votes
            </span>
          </div>
        </div>
      </article>

      {/* Release of the month — mock V2 (ratings) */}
      <article className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
        <span className="gradient-text text-[10px] font-bold tracking-wider uppercase">
          Release of the month
        </span>
        <div className="mt-3 flex items-center gap-3">
          <Image
            src={MOCK_RELEASE_OF_THE_MONTH.coverUrl}
            alt={`${MOCK_RELEASE_OF_THE_MONTH.groupName} — ${MOCK_RELEASE_OF_THE_MONTH.title}`}
            width={64}
            height={64}
            className="size-16 shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{MOCK_RELEASE_OF_THE_MONTH.title}</h3>
            <p className="text-muted-foreground font-mono text-xs uppercase">
              {MOCK_RELEASE_OF_THE_MONTH.groupName}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Star className="size-3.5 fill-yellow-500 text-yellow-500" aria-hidden />
              <span className="font-bold tabular-nums">{MOCK_RELEASE_OF_THE_MONTH.rating}</span>
              <span className="text-muted-foreground font-mono text-xs">
                {formatVotes(MOCK_RELEASE_OF_THE_MONTH.votes)} votes
              </span>
            </div>
          </div>
        </div>
      </article>

      {/* Recent comebacks — vraies données */}
      <section className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
        <div className="mb-3">
          <SectionLabel>Recent comebacks</SectionLabel>
        </div>
        {recentComebacks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No recent comebacks yet.</p>
        ) : (
          <>
            <ul className="space-y-1">
              {recentComebacks.map((cb) => (
                <li key={cb.id}>
                  <Link
                    href={eventHref(cb)}
                    className="hover:bg-muted/30 -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors"
                  >
                    {cb.image_url ? (
                      <Image
                        src={cb.image_url}
                        alt={cb.groups?.name ?? ''}
                        width={48}
                        height={48}
                        className="size-12 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div
                        className="gradient-signature flex size-12 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white"
                        aria-hidden
                      >
                        {cb.groups?.name?.[0] ?? '?'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {displaySongTitle(cb.title, cb.groups?.name)}
                      </p>
                      <p className="text-muted-foreground text-xs">{cb.groups?.name}</p>
                    </div>
                    <span className="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums">
                      {shortDate(cb.start_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/mvs"
              className="text-primary mt-3 inline-block text-xs underline-offset-2 hover:underline"
            >
              View all MVs →
            </Link>
          </>
        )}
      </section>

      {/* Recent activity — mock V2 (threads de discussion, pas encore de destination) */}
      <section className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
        <div className="mb-3">
          <SectionLabel>Recent activity</SectionLabel>
        </div>
        <ul className="space-y-0.5">
          {MOCK_RECENT_ACTIVITY.map((a) => (
            <li
              key={a.id}
              className="hover:bg-muted/30 -mx-2 flex h-9 items-center gap-2.5 rounded-md px-2 transition-colors"
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: a.groupColor }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-sm">{a.title}</span>
              <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                · {a.comments}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Community pulse — vraies données */}
      <section className="bg-card ring-foreground/10 space-y-3 rounded-xl p-4 ring-1">
        <SectionLabel>Community pulse</SectionLabel>
        {pendingCount > 0 && (
          <p>
            <span className="inline-flex rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-500">
              {pendingCount} pending suggestions
            </span>
          </p>
        )}
        <Link href="/suggest" className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
          <Lightbulb className="size-4" />
          Suggest an event
        </Link>
      </section>
    </div>
  )
}
