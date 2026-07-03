import { Landing } from '@/components/landing'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { NextDropCard } from '@/components/home/next-drop-card'
import { WeekGlance } from '@/components/home/week-glance'
import { FreshDrops } from '@/components/home/fresh-drops'
import { CommunityStrip } from '@/components/home/community-strip'
import { QueueRow } from '@/components/events/queue-row'
import { Ticker } from '@/components/ticker'
import { StatusFooter } from '@/components/status-footer'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { getGroupsCached } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getUpcomingEvents, getAllMvs, getEventsCount, type MvEvent } from '@/lib/events/queries'
import { getRatingsForEvents, getRecentCommunityActivity } from '@/lib/events/community'
import { getUpcomingAnniversaries } from '@/lib/events/anniversaries'
import { getSourcesStatus } from '@/lib/sources/queries'
import { buildTickerItems } from '@/lib/events/ticker'
import { parseTypesParam } from '@/lib/events/filters'
import { createClient } from '@/lib/supabase/server'

// Types « vrai comeback » mis en avant par le hero (un anniversaire ne doit pas
// occuper la carte principale — il reste dans la queue).
const COMEBACK_TYPES = new Set(['mv', 'release', 'music_show', 'live'])

// Home Data Desk (§7.1) : ticker → hero NEXT UP → UPCOMING QUEUE → THIS WEEK →
// FRESH DROPS → community strip → footer statut.
export default async function Home({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const [groups, previewEvents, eventsCount, sourcesStatus] = await Promise.all([
      getGroupsCached(),
      getUpcomingEvents({ limit: 4 }),
      getEventsCount(),
      getSourcesStatus(),
    ])
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-6">
        <Landing
          groups={groups}
          previewEvents={previewEvents}
          eventsCount={eventsCount}
          sourcesStatus={sourcesStatus}
        />
      </div>
    )
  }

  const sp = await searchParams
  const types = parseTypesParam(sp.type)
  const wantAnniversaries = types.length === 0 || types.includes('anniversary')

  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone, tier')
    .eq('id', user.id)
    .single()
  const timeZone = profile?.timezone ?? 'Asia/Seoul'
  const tier = profile?.tier ?? 'free'

  const followedIds = await getFollowedGroupIds()
  const ids = [...followedIds]
  const [dbEvents, anniversaries, followedMvs, recentMvs, community, sourcesStatus, globalEvents] =
    await Promise.all([
      ids.length > 0 ? getUpcomingEvents({ groupIds: ids, types, limit: 50 }) : Promise.resolve([]),
      ids.length > 0 && wantAnniversaries ? getUpcomingAnniversaries(ids, 90) : Promise.resolve([]),
      ids.length > 0 ? getAllMvs({ groupIds: ids, limit: 4 }) : Promise.resolve([]),
      getAllMvs({ limit: 4 }),
      getRecentCommunityActivity(2),
      getSourcesStatus(),
      // Repli ticker/queue quand l'user ne suit rien : le flux global.
      ids.length > 0 ? Promise.resolve([]) : getUpcomingEvents({ limit: 12 }),
    ])

  // Fresh drops : les MVs des groupes suivis d'abord, complétés au global (4 max).
  const freshMvs: MvEvent[] = [...followedMvs]
  for (const mv of recentMvs) {
    if (freshMvs.length >= 4) break
    if (!freshMvs.some((m) => m.id === mv.id)) freshMvs.push(mv)
  }
  const ratings = await getRatingsForEvents(freshMvs.map((m) => m.id))

  // Hero = prochain VRAI comeback (pas un anniversaire) ; le reste va à la queue.
  const merged = [...dbEvents, ...anniversaries].sort((a, b) =>
    a.start_at.localeCompare(b.start_at),
  )
  const heroIdx = merged.findIndex((e) => COMEBACK_TYPES.has(e.type))
  const nextDrop = heroIdx >= 0 ? merged[heroIdx] : null
  const queueSource = merged.length > 0 ? merged : globalEvents
  const queueEvents = (heroIdx >= 0 ? merged.filter((_, i) => i !== heroIdx) : queueSource).slice(
    0,
    8,
  )
  const tickerItems = buildTickerItems(merged.length > 0 ? merged : globalEvents)

  return (
    <>
      <Ticker items={tickerItems} />
      <div className="mx-auto w-full max-w-5xl px-3 py-4 md:px-4 md:py-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
            <SidebarLeft tier={tier} showFilters={false} />
          </aside>
          <div className="order-1 min-w-0 flex-1 space-y-3 lg:order-2">
            {nextDrop && (
              <NextDropCard
                event={nextDrop}
                isAuthed
                isFollowing={nextDrop.group_id ? followedIds.has(nextDrop.group_id) : false}
              />
            )}
            {queueEvents.length > 0 && (
              <Panel>
                <PanelHeader
                  label="Upcoming queue"
                  action={{ label: 'Calendar', href: '/calendar' }}
                />
                <div className="divide-y">
                  {queueEvents.map((event) => (
                    <QueueRow key={event.id} event={event} timeZone={timeZone} />
                  ))}
                </div>
              </Panel>
            )}
            <WeekGlance events={merged.length > 0 ? merged : globalEvents} timeZone={timeZone} />
            <FreshDrops mvs={freshMvs} ratings={ratings} />
            <CommunityStrip items={community} />
            <StatusFooter status={sourcesStatus} />
          </div>
        </div>
      </div>
    </>
  )
}
