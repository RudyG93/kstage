import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { faceCrop } from '@/lib/images/cloudinary'
import { getGroups } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getUpcomingEventCountsByGroup } from '@/lib/events/queries'
import { getUpcomingAnniversaryCountsByGroup } from '@/lib/events/anniversaries'
import { getProfile } from '@/lib/profiles/queries'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

// Cap d'affichage des groupes suivis pour les comptes free. Premium = illimité.
const FREE_VISIBLE_FOLLOWS = 10

export async function SidebarLeft({
  tier,
  groupFilter,
  showFilters = true,
}: {
  tier: Database['public']['Enums']['tier_type']
  // Slot optionnel injecté dans la section Filters (filtre Group du calendrier).
  groupFilter?: ReactNode
  // /groups réutilise le template SANS le bloc Filters (§3.4).
  showFilters?: boolean
}) {
  const followedIds = await getFollowedGroupIds()
  const groups = await getGroups()
  // « +X more » pointe vers le profil (où vit la liste des groupes suivis).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [profile, { data: countRows }, counts, annivCounts] = await Promise.all([
    user ? getProfile(user.id) : Promise.resolve(null),
    supabase.rpc('group_follow_counts'),
    getUpcomingEventCountsByGroup([...followedIds]),
    getUpcomingAnniversaryCountsByGroup([...followedIds]),
  ])
  const profileHref = profile?.username ? `/u/${profile.username}` : '/account'
  // Tri des groupes suivis : popularité (nb de follows) décroissante, puis alpha.
  const followCount = new Map((countRows ?? []).map((r) => [r.group_id, r.follows]))
  const followed = groups
    .filter((g) => followedIds.has(g.id))
    .sort(
      (a, b) =>
        (followCount.get(b.id) ?? 0) - (followCount.get(a.id) ?? 0) || a.name.localeCompare(b.name),
    )
  // Anniversaires inclus dans le « N upcoming » (ils y étaient oubliés).
  const countFor = (id: string) => (counts.get(id) ?? 0) + (annivCounts.get(id) ?? 0)
  const totalUpcoming = followed.reduce((a, g) => a + countFor(g.id), 0)

  const visibleFollowed = tier === 'premium' ? followed : followed.slice(0, FREE_VISIBLE_FOLLOWS)
  const hiddenCount = followed.length - visibleFollowed.length

  return (
    <div className="space-y-6 lg:sticky lg:top-20">
      {showFilters && groupFilter && (
        <section className="bg-card rounded-[10px] border p-4">
          <div className="mb-3">
            <span className="label-data">Filters</span>
          </div>
          {/* Filtre groupe/artiste (Calendar). Le filtre de type vit désormais
              dans les chips de la page Calendar (Data Desk §7.2). */}
          {groupFilter}
        </section>
      )}

      <section className="bg-card border-border shadow-soft rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="label-data">My groups</span>
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
                    {group.image_url ? (
                      <Image
                        src={faceCrop(group.image_url, 48, 48)}
                        alt=""
                        width={24}
                        height={24}
                        className="size-6 shrink-0 rounded-[7px] object-cover"
                        aria-hidden
                      />
                    ) : (
                      <span
                        className="flex size-6 shrink-0 items-center justify-center rounded-[7px] text-[11px] font-bold"
                        style={
                          group.color_hex
                            ? { backgroundColor: `${group.color_hex}24`, color: group.color_hex }
                            : undefined
                        }
                        aria-hidden
                      >
                        {group.name[0]}
                      </span>
                    )}
                    <span className="flex-1 truncate text-sm font-medium">{group.name}</span>
                    <span className="tabular text-faint text-xs">{countFor(group.id)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {hiddenCount > 0 && (
              <Link
                href={profileHref}
                className="text-muted-foreground hover:text-foreground mt-2 inline-block text-xs underline underline-offset-4"
              >
                + {hiddenCount} more
              </Link>
            )}
          </>
        )}
      </section>

      <p className="tabular text-muted-foreground px-2 text-xs">
        {followed.length} groups · {totalUpcoming} upcoming
      </p>
    </div>
  )
}
