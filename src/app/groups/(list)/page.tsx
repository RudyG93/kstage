import type { Route } from 'next'
import { Suspense } from 'react'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { RailStack } from '@/components/rails/rail-stack'
import { NewGroupsBlock } from '@/components/rails/discovery-blocks'
import { DiscussionsBlock } from '@/components/rails/community-blocks'
import { RailSkeleton } from '@/components/ui/rail-skeleton'
import { GroupsTabs, type GroupsTabData, type TabKey } from '@/components/groups/groups-tabs'
import {
  getGroupFollowCounts,
  getNonSoloGroupsCached,
  getSoloArtistsCached,
} from '@/lib/groups/queries'
import {
  getNextEventForAllGroupsCached,
  getRecentReleasesForAllGroupsCached,
} from '@/lib/events/queries'
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
  // Requêtes publiques (listes, next event, releases récentes) servies par le
  // data cache partagé (audit perf 2026-08-20) — seuls viewer/follows/fuseau
  // restent par-requête.
  const [{ user }, groupItems, soloItems, followedIds, followCount, timeZone] = await Promise.all([
    getViewer(),
    getNonSoloGroupsCached(),
    getSoloArtistsCached(),
    getFollowedGroupIds(),
    getGroupFollowCounts(),
    getViewerTimeZone(),
  ])

  const popOf = (id: string) => followCount.get(id) ?? 0

  // Trending = signal DU MOMENT (reproche Rudy 2026-07-11) : imminence d'un
  // event futur + récence d'une sortie — cached « tous groupes » (le résultat
  // couvre l'union des deux onglets).
  const [nextEvents, recentReleases] = await Promise.all([
    getNextEventForAllGroupsCached(),
    getRecentReleasesForAllGroupsCached(),
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

  // Sérialisation MINIMALE vers le client (audit perf 2026-08-20 : 550 Ko de
  // HTML dont 127 Ko de flight — chaque item partait 3×) : une seule liste par
  // onglet, champs de la tuile uniquement ; « Following » et « In the
  // spotlight » sont dérivés côté client (GroupsTabs) via followedIds/groupId.
  const toTabData = (items: typeof groupItems | typeof soloItems, countNoun: string) => {
    const sorted = sortItems(items)
    const toGridItem = (item: (typeof sorted)[number]) => {
      const next = nextEvents.get(item.id)
      return {
        group: {
          id: item.id,
          slug: item.slug,
          name: item.name,
          color_hex: item.color_hex,
          image_url: item.image_url,
        },
        href:
          'memberSlug' in item && item.memberSlug
            ? (`/artists/${item.memberSlug}` as Route)
            : undefined,
        nextEvent: next ? { type: next.type, start_at: next.start_at } : null,
      }
    }
    // nowMs = undefined → défaut Date.now() DANS la lib (purity lint RSC).
    const trending = pickTrending(items, nextEvents, recentReleases, popOf, 5, undefined, timeZone)
    return {
      items: sorted.map(toGridItem),
      trending: trending.map(({ item, reason }) => ({
        groupId: item.id,
        follows: popOf(item.id),
        reason,
      })),
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
            followedIds={[...followedIds]}
            tabs={tabs}
          />
        </div>

        {/* Rail contextuel (Lot 6) : « New on KStage » = derniers ajouts au
            roster (l'ancien « Recent comebacks » n'avait aucun rapport avec
            une page d'annuaire) ; « In the spotlight » vit déjà au centre. */}
        <aside className="order-3 shrink-0 lg:w-80">
          <Suspense fallback={<RailSkeleton />}>
            <RailStack>
              <NewGroupsBlock />
              <DiscussionsBlock />
            </RailStack>
          </Suspense>
        </aside>
      </div>
    </div>
  )
}
