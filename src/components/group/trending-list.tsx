import Image from 'next/image'
import Link from 'next/link'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { FollowButton } from '@/components/follow-button'
import { faceCrop } from '@/lib/images/cloudinary'
import { formatDDay } from '@/lib/events/date'
import { cn, compactNumber } from '@/lib/utils'
import type { GroupSummary } from '@/lib/groups/queries'
import type { NextEventInfo } from '@/components/group-card'

export interface TrendingEntry {
  group: GroupSummary
  follows: number
  isFollowing: boolean
  nextEvent: NextEventInfo | null
}

// TRENDING (§7.5.2) : rang, vignette 32px, contexte (prochain event ou agence),
// compteur de follows ABSOLU (pas d'historique → pas de « ▲n », écart assumé).
export function TrendingList({
  entries,
  isAuthed,
}: {
  entries: TrendingEntry[]
  isAuthed: boolean
}) {
  if (entries.length === 0) return null
  return (
    <Panel>
      <PanelHeader label="Trending" action={{ label: 'All', href: '/groups?sort=pop_desc' }} />
      <ol>
        {entries.map(({ group, follows, isFollowing, nextEvent }, i) => (
          <li key={group.id} className="relative border-b last:border-b-0">
            <Link
              href={`/groups/${group.slug}`}
              className="hover:bg-secondary/60 flex min-h-[44px] items-center gap-2.5 py-1.5 pr-12 pl-3 transition-colors"
            >
              <span
                className={cn(
                  'tabular w-4 shrink-0 text-[13px] font-bold',
                  i === 0 ? 'text-amber' : 'text-muted-foreground',
                )}
              >
                {i + 1}
              </span>
              {group.image_url ? (
                <Image
                  src={faceCrop(group.image_url, 64, 64)}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="size-8 shrink-0 rounded-[7px] object-cover"
                  aria-hidden
                />
              ) : (
                <span
                  className="gradient-signature flex size-8 shrink-0 items-center justify-center rounded-[7px] text-xs font-bold text-white"
                  aria-hidden
                >
                  {group.name[0]}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{group.name}</span>
                <span className="text-muted-foreground block truncate text-[10px]">
                  {nextEvent
                    ? `${nextEvent.title} · ${formatDDay(nextEvent.start_at, 'Asia/Seoul')}`
                    : (group.fandom_name ?? '—')}
                </span>
              </span>
              <span className="tabular text-teal shrink-0 text-[10px] font-semibold">
                {compactNumber(follows)} follow{follows === 1 ? '' : 's'}
              </span>
            </Link>
            <div className="absolute top-1/2 right-2 -translate-y-1/2">
              <FollowButton
                groupId={group.id}
                initialFollowing={isFollowing}
                isAuthed={isAuthed}
                iconOnly
              />
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
