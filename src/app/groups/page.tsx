import Link from 'next/link'
import { GroupCard } from '@/components/group-card'
import { getNonSoloGroups, getSoloArtists } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Groups' }

type TabKey = 'groups' | 'solo'

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab: TabKey = tab === 'solo' ? 'solo' : 'groups'

  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    items,
    followedIds,
  ] = await Promise.all([
    supabase.auth.getUser(),
    activeTab === 'solo' ? getSoloArtists() : getNonSoloGroups(),
    getFollowedGroupIds(),
  ])

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
          <nav
            aria-label="Filter by kind"
            className="bg-muted inline-flex rounded-lg p-0.5 text-sm"
          >
            <TabLink tab="groups" activeTab={activeTab}>
              Groups
            </TabLink>
            <TabLink tab="solo" activeTab={activeTab}>
              Solo
            </TabLink>
          </nav>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <GroupCard
              key={item.slug}
              group={item}
              isFollowing={followedIds.has(item.id)}
              isAuthed={!!user}
              href={
                'memberSlug' in item && item.memberSlug ? `/artists/${item.memberSlug}` : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TabLink({
  tab,
  activeTab,
  children,
}: {
  tab: TabKey
  activeTab: TabKey
  children: React.ReactNode
}) {
  const isActive = tab === activeTab
  return (
    <Link
      href={tab === 'groups' ? '/groups' : `/groups?tab=${tab}`}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'focus-visible:ring-ring/50 rounded-md px-3 py-1 font-medium outline-none focus-visible:ring-2',
        isActive
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
