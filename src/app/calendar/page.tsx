import { CalendarMonth } from '@/components/calendar-month'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { SidebarRight } from '@/components/home/sidebar-right'
import { GroupFilter } from '@/components/home/group-filter'
import { getEventsForMonth } from '@/lib/events/queries'
import { getAnniversariesForMonth } from '@/lib/events/anniversaries'
import { getGroups } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { kstDayKey } from '@/lib/events/date'
import { parseTypesParam } from '@/lib/events/filters'
import { createClient } from '@/lib/supabase/server'

function parseMonth(raw?: string): { year: number; month: number } {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number)
    if (m >= 1 && m <= 12) return { year: y, month: m }
  }
  const [y, m] = kstDayKey(new Date().toISOString()).split('-').map(Number)
  return { year: y, month: m }
}

export const metadata = { title: 'Calendar' }

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; group?: string; type?: string }>
}) {
  const sp = await searchParams
  const { year, month } = parseMonth(sp.month)
  const groupSlugs = sp.group ? sp.group.split(',').filter(Boolean) : undefined
  const types = parseTypesParam(sp.type)
  // Les anniversaires sont générés à la volée (pas en table events) → on les
  // fusionne ici pour qu'ils apparaissent au calendrier, sauf si un filtre de
  // type actif les exclut.
  const wantAnniversaries = types.length === 0 || types.includes('anniversary')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let tier: 'free' | 'premium' = 'free'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single()
    tier = profile?.tier ?? 'free'
  }

  const [groups, followedIds, dbEvents, anniversaries] = await Promise.all([
    getGroups(),
    getFollowedGroupIds(),
    getEventsForMonth({ year, month, groupSlugs, types }),
    wantAnniversaries ? getAnniversariesForMonth({ year, month, groupSlugs }) : Promise.resolve([]),
  ])
  const events = [...dbEvents, ...anniversaries].sort((a, b) =>
    a.start_at.localeCompare(b.start_at),
  )
  const followedSlugs = groups.filter((g) => followedIds.has(g.id)).map((g) => g.slug)

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
          <SidebarLeft
            tier={tier}
            groupFilter={
              <GroupFilter
                groups={groups.map((g) => ({ slug: g.slug, name: g.name }))}
                followedSlugs={followedSlugs}
              />
            }
          />
        </aside>
        <div className="order-1 min-w-0 flex-1 lg:order-2">
          <CalendarMonth year={year} month={month} events={events} />
        </div>
        <aside className="order-3 shrink-0 lg:w-80">
          <SidebarRight />
        </aside>
      </div>
    </div>
  )
}
