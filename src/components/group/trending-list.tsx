import Image from 'next/image'
import Link from 'next/link'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { FollowButton } from '@/components/follow-button'
import { faceCrop } from '@/lib/images/cloudinary'
import { cn, compactNumber } from '@/lib/utils'
import type { GroupSummary } from '@/lib/groups/queries'

export interface TrendingEntry {
  group: GroupSummary
  follows: number
  isFollowing: boolean
  /** Pourquoi le groupe est « du moment » — résolu côté serveur (uniforme). */
  reason: string
}

// TRENDING (refonte 2026-07-11) : classé par signal DU MOMENT (imminence d'un
// event + récence d'une sortie — cf. page), plus par follows cumulés. Chaque
// ligne porte sa raison en sous-titre ; les follows restent en info
// secondaire. Le lien « All » (qui re-triait la même page) est retiré : sur
// ~80 groupes, le top 5 EST la liste trending.
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
      <PanelHeader label="Trending" />
      <ol>
        {entries.map(({ group, follows, isFollowing, reason }, i) => (
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
                <span className="text-muted-foreground block truncate text-[10px]">{reason}</span>
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
                subtle
              />
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
