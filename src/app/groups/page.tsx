import Link from 'next/link'
import { GroupCard } from '@/components/group-card'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { SidebarRight } from '@/components/home/sidebar-right'
import { GroupSort } from '@/components/home/group-sort'
import { getNonSoloGroups, getSoloArtists } from '@/lib/groups/queries'
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

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
          <SidebarLeft tier={tier} showFilters={false} />
        </aside>

        <div className="order-1 min-w-0 flex-1 space-y-5 lg:order-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav
              aria-label="Filter by kind"
              className="bg-muted inline-flex rounded-lg p-0.5 text-sm"
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

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {sorted.map((item) => (
              <GroupCard
                key={item.slug}
                group={item}
                isFollowing={followedIds.has(item.id)}
                isAuthed={!!user}
                href={
                  'memberSlug' in item && item.memberSlug
                    ? `/artists/${item.memberSlug}`
                    : undefined
                }
              />
            ))}
          </div>
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
        'focus-visible:ring-ring/50 rounded-md px-3 py-1 font-medium transition-colors outline-none focus-visible:ring-2',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
