import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getRecentComebacks } from '@/lib/events/queries'
import { displaySongTitle } from '@/lib/events/title'
import { eventHref } from '@/lib/events/href'

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
  const recentComebacks = await getRecentComebacks(10)

  return (
    <div className="space-y-4 lg:sticky lg:top-20">
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
    </div>
  )
}
