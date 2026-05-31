import { Landing } from '@/components/landing'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { NextDropCard } from '@/components/home/next-drop-card'
import { Feed } from '@/components/home/feed'
import { SidebarRight } from '@/components/home/sidebar-right'
import { getGroups } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getUpcomingEvents } from '@/lib/events/queries'
import { getUpcomingAnniversaries } from '@/lib/events/anniversaries'
import { parseTypesParam } from '@/lib/events/filters'
import { createClient } from '@/lib/supabase/server'

export default async function Home({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const groups = await getGroups()

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <Landing groups={groups} />
      </div>
    )
  }

  const sp = await searchParams
  const types = parseTypesParam(sp.type)
  const wantAnniversaries = types.length === 0 || types.includes('anniversary')

  // Fuseau de tri today/tomorrow/later : préférence user, fallback Séoul.
  // (la détection client pour l'anonyme + l'affichage heure-locale → §3.1)
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone, tier')
    .eq('id', user.id)
    .single()
  const timeZone = profile?.timezone ?? 'Asia/Seoul'
  const tier = profile?.tier ?? 'free'

  const followedIds = await getFollowedGroupIds()
  const ids = [...followedIds]
  const [dbEvents, anniversaries] =
    ids.length > 0
      ? await Promise.all([
          getUpcomingEvents({ groupIds: ids, types, limit: 50 }),
          wantAnniversaries ? getUpcomingAnniversaries(ids, 90) : Promise.resolve([]),
        ])
      : [[], []]
  // "Next drop" et le feed se basent sur le même flux trié (DB events +
  // anniversaires), pour que le filtre type s'applique de manière cohérente
  // (ex: type=anniversary → nextDrop = prochain anniversaire).
  const merged = [...dbEvents, ...anniversaries].sort((a, b) =>
    a.start_at.localeCompare(b.start_at),
  )
  const nextDrop = merged[0] ?? null
  const feedEvents = merged.slice(1)

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
          <SidebarLeft tier={tier} />
        </aside>
        <div className="order-1 min-w-0 flex-1 space-y-8 lg:order-2">
          <NextDropCard event={nextDrop} />
          <Feed events={feedEvents} timeZone={timeZone} />
        </div>
        <aside className="order-3 shrink-0 lg:w-80">
          <SidebarRight />
        </aside>
      </div>
    </div>
  )
}
