import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { SidebarRight } from '@/components/home/sidebar-right'
import { HeroBackdrop } from '@/components/home/hero-backdrop'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { MvChart } from '@/components/mv/mv-chart'
import { DropsGrid } from '@/components/mv/drops-grid'
import { getAllMvs } from '@/lib/events/queries'
import { getRatingsForEvents } from '@/lib/events/community'
import { getTopRatedByPeriods } from '@/lib/events/top-rated'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { displaySongTitle } from '@/lib/events/title'
import { shortDate } from '@/lib/events/date'
import { getViewerTimeZone } from '@/lib/profiles/timezone'

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
  const followedIds = await getFollowedGroupIds()
  const feed = sp.feed === 'following' && followedIds.size > 0 ? 'following' : 'all'

  // Les DEUX jeux (All + Following) partent au client : les pills filtrent en
  // mémoire (R5) au lieu d'une navigation ?feed=&sort= qui re-rendait la page.
  const [latest, followingMvs, topRated, timeZone] = await Promise.all([
    getAllMvs({ limit: 31 }),
    followedIds.size > 0
      ? getAllMvs({ groupIds: [...followedIds], limit: 30 })
      : Promise.resolve([]),
    getTopRatedByPeriods(5),
    getViewerTimeZone(),
  ])

  const hero = latest[0] ?? null
  const allGrid = latest.filter((m) => m.id !== hero?.id)
  const ratings = await getRatingsForEvents([
    ...(hero ? [hero.id] : []),
    ...allGrid.map((m) => m.id),
    ...followingMvs.map((m) => m.id),
  ])
  const ratingsRecord = Object.fromEntries(ratings)

  const heroGroup = hero?.groups ?? null
  const heroVideoId = hero ? extractYouTubeId(hero.source_url) : null
  const heroRating = hero ? ratings.get(hero.id) : undefined

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-4 md:px-4 md:py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
          <SidebarLeft showFilters={false} />
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
                        {heroGroup.name} · {shortDate(hero.start_at, timeZone)}
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

          <MvChart periods={topRated} timeZone={timeZone} />

          <DropsGrid
            all={allGrid}
            following={followingMvs}
            ratings={ratingsRecord}
            hasFollows={followedIds.size > 0}
            initialFeed={feed}
            initialSort={sort}
            timeZone={timeZone}
          />
        </div>

        <aside className="order-3 shrink-0 lg:w-80">
          <SidebarRight />
        </aside>
      </div>
    </div>
  )
}
