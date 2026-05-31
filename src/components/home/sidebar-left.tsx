import Link from 'next/link'
import { getGroups } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getUpcomingEventCountsByGroup } from '@/lib/events/queries'
import type { Database } from '@/types/database'
import { TypeFilterVertical } from './type-filter-vertical'

// Cap d'affichage des groupes suivis pour les comptes free. Premium = illimité.
const FREE_VISIBLE_FOLLOWS = 10

export async function SidebarLeft({ tier }: { tier: Database['public']['Enums']['tier_type'] }) {
  const followedIds = await getFollowedGroupIds()
  const groups = await getGroups()
  const followed = groups.filter((g) => followedIds.has(g.id))
  const counts = await getUpcomingEventCountsByGroup([...followedIds])
  const totalUpcoming = [...counts.values()].reduce((a, b) => a + b, 0)

  const visibleFollowed = tier === 'premium' ? followed : followed.slice(0, FREE_VISIBLE_FOLLOWS)
  const hiddenCount = followed.length - visibleFollowed.length

  return (
    <div className="space-y-6 lg:sticky lg:top-20">
      <section className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
        <div className="mb-3">
          <span className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
            Filters
          </span>
        </div>
        <TypeFilterVertical />
      </section>

      <section className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
            My groups
          </span>
          <Link href="/groups" className="text-muted-foreground hover:text-foreground text-xs">
            manage
          </Link>
        </div>
        {followed.length === 0 ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">You don&apos;t follow any groups yet.</p>
            <Link href="/groups" className="text-foreground text-sm underline underline-offset-4">
              Browse groups
            </Link>
          </div>
        ) : (
          <>
            <ul className="space-y-0.5">
              {visibleFollowed.map((group) => (
                <li key={group.id}>
                  <Link
                    href={`/groups/${group.slug}`}
                    className="hover:bg-muted/40 -mx-2 flex h-10 items-center gap-2.5 rounded-md px-2 transition-colors"
                  >
                    <span className="flex-1 truncate text-sm font-medium">{group.name}</span>
                    <span className="text-muted-foreground font-mono text-xs tabular-nums">
                      · {counts.get(group.id) ?? 0}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {hiddenCount > 0 && (
              <Link
                href="/groups"
                className="text-muted-foreground hover:text-foreground mt-2 inline-block text-xs underline underline-offset-4"
              >
                + {hiddenCount} more
              </Link>
            )}
          </>
        )}
      </section>

      <p className="text-muted-foreground px-2 font-mono text-xs">
        {followed.length} groups · {totalUpcoming} upcoming
      </p>
    </div>
  )
}
