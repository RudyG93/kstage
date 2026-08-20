import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { TrendingList, type TrendingEntry } from '@/components/group/trending-list'
import { getGroupFollowCounts, getGroupsCached, getNewestGroupsCached } from '@/lib/groups/queries'
import {
  getNextEventForAllGroupsCached,
  getRecentReleasesForAllGroupsCached,
} from '@/lib/events/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { pickTrending } from '@/lib/groups/trending'
import { getViewerTimeZone } from '@/lib/profiles/timezone'
import { getViewer } from '@/lib/supabase/viewer'
import { relativeTime } from '@/lib/events/date'
import { faceCrop } from '@/lib/images/cloudinary'

// Blocs découverte des rails contextuels (Lot 6 peaufinage 2026-08-20).

/** Derniers groupes/solistes ajoutés au roster — rail /groups. Met en avant
    la couverture qui grandit (les solos passent par le redirect /groups→
    /artists déjà en place). */
export async function NewGroupsBlock() {
  const newest = await getNewestGroupsCached(6)
  if (newest.length === 0) return null
  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3">
        <span className="label-data">New on KStage</span>
      </div>
      <ul className="space-y-1">
        {newest.map((g) => (
          <li key={g.id}>
            <Link
              href={`/groups/${g.slug}` as Route}
              className="hover:bg-hover -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
            >
              {g.image_url ? (
                <Image
                  src={faceCrop(g.image_url, 64, 64)}
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
                  {g.name[0]}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{g.name}</span>
                <span className="text-muted-foreground block truncate text-[10px]">
                  {g.is_solo ? 'Soloist' : 'Group'} · added {relativeTime(g.created_at)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** « In the spotlight » (imminence + récence, déjà calculé pour /groups) —
    rail des pages détail groupe/artiste. `excludeSlug` écarte l'artiste de
    la page courante (règle : jamais de lien vers soi-même). */
export async function SpotlightBlock({ excludeSlug }: { excludeSlug?: string }) {
  const [{ user }, groups, followedIds, followCounts, nextEvents, recentReleases, timeZone] =
    await Promise.all([
      getViewer(),
      getGroupsCached(),
      getFollowedGroupIds(),
      getGroupFollowCounts(),
      getNextEventForAllGroupsCached(),
      getRecentReleasesForAllGroupsCached(),
      getViewerTimeZone(),
    ])
  const pool = excludeSlug ? groups.filter((g) => g.slug !== excludeSlug) : groups
  const popOf = (id: string) => followCounts.get(id) ?? 0
  // nowMs = undefined → défaut Date.now() DANS la lib (purity lint RSC).
  const trending = pickTrending(pool, nextEvents, recentReleases, popOf, 5, undefined, timeZone)
  if (trending.length === 0) return null
  const entries: TrendingEntry[] = trending.map(({ item, reason }) => ({
    group: item,
    follows: popOf(item.id),
    isFollowing: followedIds.has(item.id),
    reason,
  }))
  return <TrendingList entries={entries} isAuthed={!!user} />
}
