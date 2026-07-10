import Link from 'next/link'
import { GroupCard } from '@/components/group-card'
import { GroupsGrid } from '@/components/groups-grid'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { SidebarRight } from '@/components/home/sidebar-right'
import { GroupSort } from '@/components/home/group-sort'
import { TrendingList, type TrendingEntry } from '@/components/group/trending-list'
import { getNonSoloGroups, getSoloArtists } from '@/lib/groups/queries'
import { getNextEventForGroups } from '@/lib/events/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Groups' }

type TabKey = 'groups' | 'solo'
type SortKey = 'az' | 'za' | 'pop_desc' | 'pop_asc'

const SORT_KEYS: readonly SortKey[] = ['az', 'za', 'pop_desc', 'pop_asc']

function buildHref(tab: TabKey, sort: SortKey): string {
  const params = new URLSearchParams()
  if (tab === 'solo') params.set('tab', 'solo')
  if (sort !== 'az') params.set('sort', sort)
  const qs = params.toString()
  return qs ? `/groups?${qs}` : '/groups'
}

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sort?: string }>
}) {
  const sp = await searchParams
  const activeTab: TabKey = sp.tab === 'solo' ? 'solo' : 'groups'
  const activeSort: SortKey = (SORT_KEYS as string[]).includes(sp.sort ?? '')
    ? (sp.sort as SortKey)
    : 'az'

  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    items,
    followedIds,
    { data: countRows },
  ] = await Promise.all([
    supabase.auth.getUser(),
    activeTab === 'solo' ? getSoloArtists() : getNonSoloGroups(),
    getFollowedGroupIds(),
    supabase.rpc('group_follow_counts'),
  ])

  let tier: 'free' | 'premium' = 'free'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single()
    tier = profile?.tier ?? 'free'
  }

  const followCount = new Map((countRows ?? []).map((r) => [r.group_id, r.follows]))
  const popOf = (id: string) => followCount.get(id) ?? 0

  const sorted = [...items].sort((a, b) => {
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

  // Ligne statut des tuiles (prochain event) : groupes suivis + top trending.
  const followedItems = sorted.filter((g) => followedIds.has(g.id))
  const trendingCandidates = [...items]
    .sort((a, b) => popOf(b.id) - popOf(a.id) || a.name.localeCompare(b.name))
    .slice(0, 5)
  const nextEvents = await getNextEventForGroups([
    ...new Set([...followedItems.map((g) => g.id), ...trendingCandidates.map((g) => g.id)]),
  ])

  const toGridItem = (item: (typeof sorted)[number]) => ({
    group: item,
    isFollowing: followedIds.has(item.id),
    isAuthed: !!user,
    href: 'memberSlug' in item && item.memberSlug ? `/artists/${item.memberSlug}` : undefined,
    nextEvent: nextEvents.get(item.id) ?? null,
  })

  const trendingEntries: TrendingEntry[] = trendingCandidates.map((g) => ({
    group: g,
    follows: popOf(g.id),
    isFollowing: followedIds.has(g.id),
    nextEvent: nextEvents.get(g.id) ?? null,
  }))

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-4 md:px-4 md:py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
          <SidebarLeft tier={tier} showFilters={false} />
        </aside>

        <div className="order-1 min-w-0 flex-1 space-y-4 lg:order-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-heading text-[17px] font-extrabold tracking-[-0.01em]">Groups</h1>
            <div className="flex items-center gap-2">
              <nav
                aria-label="Filter by kind"
                className="bg-secondary inline-flex gap-0.5 rounded-md border p-0.5"
              >
                <SegmentLink href={buildHref('groups', activeSort)} active={activeTab === 'groups'}>
                  Groups
                </SegmentLink>
                <SegmentLink href={buildHref('solo', activeSort)} active={activeTab === 'solo'}>
                  Solo
                </SegmentLink>
              </nav>
              <GroupSort value={activeSort} />
            </div>
          </div>

          {followedItems.length > 0 && (
            <section className="space-y-2">
              <span className="label-data">Following — {followedItems.length}</span>
              <div className="grid grid-cols-2 gap-[9px] md:grid-cols-3">
                {followedItems.map((item) => (
                  <GroupCard key={item.slug} {...toGridItem(item)} />
                ))}
              </div>
            </section>
          )}

          <TrendingList entries={trendingEntries} isAuthed={!!user} />

          <section className="space-y-2">
            <span className="label-data">
              All {activeTab === 'solo' ? 'soloists' : 'groups'} — {sorted.length}
            </span>
            <GroupsGrid items={sorted.map(toGridItem)} />
          </section>
        </div>

        <aside className="order-3 shrink-0 lg:w-80">
          <SidebarRight />
        </aside>
      </div>
    </div>
  )
}

function SegmentLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'label-data-inline focus-visible:ring-ring/50 rounded-sm px-2.5 py-1.5 text-[9px] transition-colors outline-none focus-visible:ring-2',
        active ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
