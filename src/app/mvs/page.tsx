import type { Metadata } from 'next'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { SidebarRight } from '@/components/home/sidebar-right'
import { MvCard } from '@/components/group/mv-card'
import { MvScrollRow } from '@/components/mv/mv-scroll-row'
import { getAllMvs, type MvEvent } from '@/lib/events/queries'
import { getRatingsForEvents } from '@/lib/events/community'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Music videos',
  description: 'Browse all k-pop music videos tracked on KStage.',
}

const PER_GROUP = 10

export default async function MvsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const followedIds = await getFollowedGroupIds()
  const followedArr = [...followedIds]

  let tier: 'free' | 'premium' = 'free'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single()
    tier = profile?.tier ?? 'free'
  }

  const [followedMvs, latest] = await Promise.all([
    followedArr.length > 0 ? getAllMvs({ groupIds: followedArr, limit: 300 }) : Promise.resolve([]),
    getAllMvs({ limit: 30 }),
  ])

  // 1 ligne par groupe suivi (ordre = MV le plus récent), 10 MV max chacun.
  const byGroup = new Map<
    string,
    { name: string; slug: string; image: string | null; color: string | null; mvs: MvEvent[] }
  >()
  for (const mv of followedMvs) {
    const g = mv.groups
    if (!g?.slug) continue
    let row = byGroup.get(g.slug)
    if (!row) {
      row = { name: g.name, slug: g.slug, image: g.image_url, color: g.color_hex, mvs: [] }
      byGroup.set(g.slug, row)
    }
    if (row.mvs.length < PER_GROUP) row.mvs.push(mv)
  }
  const rows = [...byGroup.values()]

  const ratings = await getRatingsForEvents([
    ...rows.flatMap((r) => r.mvs.map((m) => m.id)),
    ...latest.map((m) => m.id),
  ])

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
          <SidebarLeft tier={tier} showFilters={false} />
        </aside>

        <div className="order-1 min-w-0 flex-1 space-y-8 lg:order-2">
          {rows.length > 0 && (
            <div className="space-y-6">
              <span className="text-faint text-xs font-semibold">From your groups</span>
              {rows.map((row) => (
                <MvScrollRow
                  key={row.slug}
                  title={row.name}
                  href={`/groups/${row.slug}`}
                  mvs={row.mvs}
                  ratings={ratings}
                  image={row.image}
                  color={row.color}
                />
              ))}
            </div>
          )}

          <section className="space-y-3">
            <span className="text-faint text-xs font-semibold">Latest MVs</span>
            {latest.length === 0 ? (
              <p className="text-muted-foreground text-sm">No music videos tracked yet.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {latest.map((mv) => (
                  <li key={mv.id}>
                    <MvCard mv={mv} rating={ratings.get(mv.id)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="order-3 shrink-0 lg:w-80">
          <SidebarRight />
        </aside>
      </div>
    </div>
  )
}
