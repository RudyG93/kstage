import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { SidebarRight } from '@/components/home/sidebar-right'
import { HeroBackdrop } from '@/components/home/hero-backdrop'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { MvCard } from '@/components/group/mv-card'
import { MvChart } from '@/components/mv/mv-chart'
import { getAllMvs } from '@/lib/events/queries'
import { getRatingsForEvents } from '@/lib/events/community'
import { getTopRatedByPeriods } from '@/lib/events/top-rated'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { displaySongTitle } from '@/lib/events/title'
import { formatKst } from '@/lib/events/date'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Drops',
  description: 'Browse all k-pop music videos tracked on KStage.',
  alternates: { canonical: '/mvs' },
}

// « MV Desk » (R4-H) : hero = dernier drop, Top rated juste dessous, puis la
// grille avec filtre All|Following. Les rails par groupe suivi sont retirés —
// ils dupliquaient les pages groupe, poussaient le contenu sous le fold pour
// les gros followers, et servaient le carré Spotify brut en bande 64px
// (visages coupés, source divergente des pages groupe — reproche R4).

export default async function MvsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; feed?: string }>
}) {
  const sp = await searchParams
  const sort = sp.sort === 'top' ? 'top' : 'new'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const followedIds = await getFollowedGroupIds()
  const feed = sp.feed === 'following' && followedIds.size > 0 ? 'following' : 'all'

  let tier: 'free' | 'premium' = 'free'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single()
    tier = profile?.tier ?? 'free'
  }

  const [latest, followingMvs, topRated] = await Promise.all([
    getAllMvs({ limit: 31 }),
    feed === 'following'
      ? getAllMvs({ groupIds: [...followedIds], limit: 30 })
      : Promise.resolve([]),
    getTopRatedByPeriods(5),
  ])

  const hero = latest[0] ?? null
  const gridSource = feed === 'following' ? followingMvs : latest.filter((m) => m.id !== hero?.id)
  const ratings = await getRatingsForEvents([
    ...(hero ? [hero.id] : []),
    ...gridSource.map((m) => m.id),
  ])
  const sortedGrid =
    sort === 'top'
      ? [...gridSource].sort(
          (a, b) => (ratings.get(b.id)?.avg ?? -1) - (ratings.get(a.id)?.avg ?? -1),
        )
      : gridSource

  const heroGroup = hero?.groups ?? null
  const heroVideoId = hero ? extractYouTubeId(hero.source_url) : null
  const heroRating = hero ? ratings.get(hero.id) : undefined
  const feedHref = (f: 'all' | 'following') =>
    `/mvs?${new URLSearchParams({ ...(sort === 'top' ? { sort: 'top' } : {}), ...(f === 'following' ? { feed: 'following' } : {}) }).toString()}`.replace(
      /\?$/,
      '',
    )
  const sortHref = (s: 'new' | 'top') =>
    `/mvs?${new URLSearchParams({ ...(s === 'top' ? { sort: 'top' } : {}), ...(feed === 'following' ? { feed: 'following' } : {}) }).toString()}`.replace(
      /\?$/,
      '',
    )

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-4 md:px-4 md:py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
          <SidebarLeft tier={tier} showFilters={false} />
        </aside>

        <div className="order-1 min-w-0 flex-1 space-y-4 lg:order-2">
          <h1 className="font-heading text-[17px] font-extrabold tracking-[-0.01em]">Drops</h1>

          {hero && heroGroup && (
            <Panel>
              <PanelHeader label="Latest drop" />
              <Link
                href={`/mv/${hero.slug}`}
                className="focus-visible:ring-primary/40 group relative block overflow-hidden outline-none focus-visible:ring-2"
                style={{ borderLeft: `3px solid ${heroGroup.color_hex ?? 'var(--primary)'}` }}
              >
                <div className="relative aspect-[21/9] sm:aspect-[3/1]">
                  {heroVideoId && (
                    <HeroBackdrop
                      src={`https://i.ytimg.com/vi/${heroVideoId}/maxresdefault.jpg`}
                      fallbackSrc={`https://i.ytimg.com/vi/${heroVideoId}/hqdefault.jpg`}
                    />
                  )}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(to top, var(--card) 0%, color-mix(in srgb, var(--card) 45%, transparent) 38%, transparent 70%)',
                    }}
                    aria-hidden
                  />
                  <div className="absolute right-0 bottom-0 left-0 flex items-end gap-3 p-3.5">
                    {heroGroup.image_url && (
                      <Image
                        src={heroGroup.image_url}
                        alt=""
                        width={44}
                        height={44}
                        className="size-11 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="label-data-inline text-muted-foreground text-[9px]">
                        {heroGroup.name} ·{' '}
                        {formatKst(hero.start_at, { month: 'short', day: 'numeric' })}
                      </p>
                      <h2 className="font-heading group-hover:text-primary truncate text-lg leading-tight font-extrabold tracking-[-0.02em] transition-colors">
                        {displaySongTitle(hero.title, heroGroup.name)}
                      </h2>
                    </div>
                    {heroRating && heroRating.count > 0 && (
                      <span className="label-data-inline bg-page/60 text-primary shrink-0 rounded-[4px] px-2 py-1 text-[10px] font-semibold backdrop-blur-sm">
                        {heroRating.avg.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </Panel>
          )}

          <MvChart periods={topRated} />

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <span className="label-data">Latest drops</span>
                {followedIds.size > 0 && (
                  <div className="ml-2 flex items-center gap-1">
                    {(['all', 'following'] as const).map((f) => (
                      <Link
                        key={f}
                        href={feedHref(f)}
                        aria-current={feed === f ? 'true' : undefined}
                        className={cn(
                          'label-data-inline rounded-sm px-2 py-1 text-[9px] transition-colors',
                          feed === f
                            ? 'bg-foreground text-background'
                            : 'bg-secondary text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {f === 'all' ? 'All' : 'Following'}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="label-data-inline text-faint text-[9px]">Sort:</span>
                {(['new', 'top'] as const).map((s) => (
                  <Link
                    key={s}
                    href={sortHref(s)}
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
            {sortedGrid.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {feed === 'following'
                  ? 'No music videos from your groups yet.'
                  : 'No music videos tracked yet.'}
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-[9px] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {sortedGrid.map((mv) => (
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
