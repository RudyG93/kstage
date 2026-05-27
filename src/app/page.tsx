import { Landing } from '@/components/landing'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { NextDropCard } from '@/components/home/next-drop-card'
import { Feed } from '@/components/home/feed'
import { SidebarRight } from '@/components/home/sidebar-right'
import { getGroups } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getUpcomingEvents } from '@/lib/events/queries'
import { getUpcomingAnniversaries } from '@/lib/events/anniversaries'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
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

  const followedIds = await getFollowedGroupIds()
  const ids = [...followedIds]
  const [dbEvents, anniversaries] =
    ids.length > 0
      ? await Promise.all([
          getUpcomingEvents({ groupIds: ids, limit: 50 }),
          getUpcomingAnniversaries(ids, 90),
        ])
      : [[], []]
  // "Next drop" = vrai event (sortie), pas un anniversaire ; les anniversaires
  // sont fusionnés dans le feed, triés par date.
  const nextDrop = dbEvents[0] ?? null
  const feedEvents = [...dbEvents.slice(1), ...anniversaries].sort((a, b) =>
    a.start_at.localeCompare(b.start_at),
  )

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
          <SidebarLeft />
        </aside>
        <div className="order-1 min-w-0 flex-1 space-y-8 lg:order-2">
          <NextDropCard event={nextDrop} />
          <Feed events={feedEvents} />
        </div>
        <aside className="order-3 shrink-0 lg:w-80">
          <SidebarRight />
        </aside>
      </div>
    </div>
  )
}
