import type { Metadata } from 'next'
import Link from 'next/link'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { SidebarRight } from '@/components/home/sidebar-right'
import { MvCard } from '@/components/group/mv-card'
import { MvChart } from '@/components/mv/mv-chart'
import { MvScrollRow } from '@/components/mv/mv-scroll-row'
import { getAllMvs, type MvEvent } from '@/lib/events/queries'
import { getRatingsForEvents } from '@/lib/events/community'
import { getTopRatedByPeriods } from '@/lib/events/top-rated'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getGroups } from '@/lib/groups/queries'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Drops',
  description: 'Browse all k-pop music videos tracked on KStage.',
  alternates: { canonical: '/mvs' },
}

const PER_GROUP = 10

export default async function MvsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>
}) {
  const sp = await searchParams
  const sort = sp.sort === 'top' ? 'top' : 'new'
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

  const [followedMvs, latest, groups, { data: countRows }, topRated] = await Promise.all([
    followedArr.length > 0 ? getAllMvs({ groupIds: followedArr, limit: 300 }) : Promise.resolve([]),
    getAllMvs({ limit: 30 }),
    getGroups(),
    supabase.rpc('group_follow_counts'),
    getTopRatedByPeriods(5),
  ])

  // 1 rail par groupe suivi (ordre = MV le plus récent), 10 MV max chacun.
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
  const countById = new Map((countRows ?? []).map((r) => [r.group_id, r.follows]))
  const followBySlug = new Map(groups.map((g) => [g.slug, countById.get(g.id) ?? 0]))
  const rows = [...byGroup.values()].sort(
    (a, b) =>
      (followBySlug.get(b.slug) ?? 0) - (followBySlug.get(a.slug) ?? 0) ||
      a.name.localeCompare(b.name),
  )

  const ratings = await getRatingsForEvents([
    ...rows.flatMap((r) => r.mvs.map((m) => m.id)),
    ...latest.map((m) => m.id),
  ])

  // Tri LATEST DROPS : nouveauté (défaut) ou note moyenne.
  const sortedLatest =
    sort === 'top'
      ? [...latest].sort((a, b) => (ratings.get(b.id)?.avg ?? -1) - (ratings.get(a.id)?.avg ?? -1))
      : latest

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-4 md:px-4 md:py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
          <SidebarLeft tier={tier} showFilters={false} />
        </aside>

        <div className="order-1 min-w-0 flex-1 space-y-4 lg:order-2">
          <h1 className="font-heading text-[17px] font-extrabold tracking-[-0.01em]">Drops</h1>

          {rows.length > 0 && (
            <section className="space-y-4">
              <span className="label-data">From your groups</span>
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
            </section>
          )}

          <MvChart periods={topRated} />

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="label-data">Latest drops</span>
              <div className="flex items-center gap-1">
                <span className="label-data-inline text-faint text-[9px]">Sort:</span>
                {(['new', 'top'] as const).map((s) => (
                  <Link
                    key={s}
                    href={s === 'new' ? '/mvs' : '/mvs?sort=top'}
                    aria-current={sort === s ? 'true' : undefined}
                    className={cn(
                      'label-data-inline rounded-sm px-2 py-1 text-[9px] transition-colors',
                      sort === s
                        ? 'bg-foreground text-background'
                        : 'bg-secondary text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>
            {sortedLatest.length === 0 ? (
              <p className="text-muted-foreground text-sm">No music videos tracked yet.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-[9px] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {sortedLatest.map((mv) => (
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
