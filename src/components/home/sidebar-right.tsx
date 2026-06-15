import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  getRecentComebacks,
  getRecentlyCommentedEvents,
  type CommentedEvent,
} from '@/lib/events/queries'
import { displaySongTitle } from '@/lib/events/title'
import { eventHref } from '@/lib/events/href'
import { CommentsRealtime } from '@/components/home/comments-realtime'

// En dessous, la section « Recent discussions » est masquée (anti-ville-fantôme).
const DISCUSSIONS_MIN = 3

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

// Temps relatif court (calculé côté serveur au render). Calque de comment-item.
const relTime = (iso: string) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return shortDate(iso)
}

function DiscussionLine({ row }: { row: CommentedEvent }) {
  const count = row.commentCount
  return (
    <li>
      <Link
        href={eventHref(row)}
        className="hover:bg-muted/30 -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors"
      >
        {row.image_url ? (
          <Image
            src={row.image_url}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-md object-cover"
            aria-hidden
          />
        ) : (
          <div
            className="gradient-signature flex size-10 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
            aria-hidden
          >
            {row.groups?.name?.[0] ?? '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {displaySongTitle(row.title, row.groups?.name)}
          </p>
          <p className="text-muted-foreground text-xs">
            {count} comment{count === 1 ? '' : 's'} · {relTime(row.lastCommentAt)}
          </p>
        </div>
      </Link>
    </li>
  )
}

export async function SidebarRight() {
  const [recentComebacks, discussions] = await Promise.all([
    getRecentComebacks(10),
    getRecentlyCommentedEvents(12),
  ])

  return (
    <div className="space-y-4 lg:sticky lg:top-20">
      {/* Refresh live de "Recent discussions" sur nouveau commentaire (§7.2) */}
      <CommentsRealtime />

      {/* Recent comebacks — au-dessus de Recent discussions (§7.1) */}
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

      {/* Recent discussions — forum-like, live (§7.2). Masqué sous un seuil :
          1-2 threads isolés = effet ville fantôme. Feature sociale dont la valeur
          dépend de l'audience (règle de gel) → affichée seulement avec assez de
          matière. */}
      {discussions.length >= DISCUSSIONS_MIN && (
        <section className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
          <div className="mb-3">
            <SectionLabel>Recent discussions</SectionLabel>
          </div>
          <ul className="space-y-1">
            {discussions.map((row) => (
              <DiscussionLine key={row.id} row={row} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
