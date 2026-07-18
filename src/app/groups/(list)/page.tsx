import type { Route } from 'next'
import { Suspense } from 'react'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { SidebarRight } from '@/components/home/sidebar-right'
import { RailSkeleton } from '@/components/ui/rail-skeleton'
import { GroupsTabs, type GroupsTabData, type TabKey } from '@/components/groups/groups-tabs'
import type { TrendingEntry } from '@/components/group/trending-list'
import { getGroupFollowCounts, getNonSoloGroups, getSoloArtists } from '@/lib/groups/queries'
import { getNextEventForGroups, getRecentReleasesForGroups } from '@/lib/events/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { pickTrending } from '@/lib/groups/trending'
import { getViewerTimeZone } from '@/lib/profiles/timezone'
import { getViewer } from '@/lib/supabase/viewer'

export const metadata = { title: 'Groups' }

type SortKey = 'az' | 'za' | 'pop_desc' | 'pop_asc'

const SORT_KEYS: readonly SortKey[] = ['az', 'za', 'pop_desc', 'pop_asc']

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sort?: string }>
}) {
  const sp = await searchParams
  const initialTab: TabKey = sp.tab === 'solo' ? 'solo' : 'groups'
  const activeSort: SortKey = (SORT_KEYS as string[]).includes(sp.sort ?? '')
    ? (sp.sort as SortKey)
    : 'az'

  // Les DEUX jeux (groupes + solos) sont chargés d'un coup : la bascule
  // d'onglet est 100 % client (retour Rudy 2026-07-17 — la nav ?tab=
  // re-rendait toute la page). ~172 items au total, coût marginal.
  const [{ user }, groupItems, soloItems, followedIds, followCount, timeZone] = await Promise.all([
    getViewer(),
    getNonSoloGroups(),
    getSoloArtists(),
    getFollowedGroupIds(),
    getGroupFollowCounts(),
    getViewerTimeZone(),
  ])

  const popOf = (id: string) => followCount.get(id) ?? 0

  // Trending = signal DU MOMENT (reproche Rudy 2026-07-11) : imminence d'un
  // event futur + récence d'une sortie. Un fetch .in() sur l'UNION des deux
  // onglets — sert aussi la ligne statut des tuiles.
  const allIds = [...groupItems, ...soloItems].map((g) => g.id)
  const [nextEvents, recentReleases] = await Promise.all([
    getNextEventForGroups(allIds),
    getRecentReleasesForGroups(allIds, 30),
  ])

  const sortItems = <T extends { id: string; name: string }>(items: readonly T[]): T[] =>
    [...items].sort((a, b) => {
      switch (activeSort) {
        case 'za':
          return b.name.localeCompare(a.name)
        case 'pop_desc':
          return popOf(b.id) - popOf(a.id) || a.name.localeCompare(b.name)
        case 'pop_asc':
          return popOf(a.id) - popOf(b.id) || a.name.localeCompare(b.name)
        default:
          return a.name.localeCompare(b.name)
      }
    })

  const toTabData = (items: typeof groupItems | typeof soloItems, countNoun: string) => {
    const sorted = sortItems(items)
    const toGridItem = (item: (typeof sorted)[number]) => ({
      group: item,
      isFollowing: followedIds.has(item.id),
      isAuthed: !!user,
      href:
        'memberSlug' in item && item.memberSlug
          ? (`/artists/${item.memberSlug}` as Route)
          : undefined,
      nextEvent: nextEvents.get(item.id) ?? null,
    })
    // nowMs = undefined → défaut Date.now() DANS la lib (purity lint RSC).
    const trending = pickTrending(items, nextEvents, recentReleases, popOf, 5, undefined, timeZone)
    const trendingEntries: TrendingEntry[] = trending.map(({ item, reason }) => ({
      group: item,
      follows: popOf(item.id),
      isFollowing: followedIds.has(item.id),
      reason,
    }))
    return {
      followedItems: sorted.filter((g) => followedIds.has(g.id)).map(toGridItem),
      trendingEntries,
      items: sorted.map(toGridItem),
      countNoun,
    } satisfies GroupsTabData
  }

  const tabs: Record<TabKey, GroupsTabData> = {
    groups: toTabData(groupItems, 'groups'),
    solo: toTabData(soloItems, 'soloists'),
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-4 md:px-4 md:py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
          <Suspense fallback={<RailSkeleton />}>
            <SidebarLeft showFilters={false} />
          </Suspense>
        </aside>

        <div className="order-1 min-w-0 flex-1 lg:order-2">
          <GroupsTabs
            initialTab={initialTab}
            sort={activeSort}
            timeZone={timeZone}
            isAuthed={!!user}
            tabs={tabs}
          />
        </div>

        <aside className="order-3 shrink-0 lg:w-80">
          <Suspense fallback={<RailSkeleton />}>
            <SidebarRight />
          </Suspense>
        </aside>
      </div>
    </div>
  )
}
