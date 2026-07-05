import { CalendarMonth } from '@/components/calendar-month'
import { FilterChips } from '@/components/calendar/filter-chips'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { SidebarRight } from '@/components/home/sidebar-right'
import { GroupFilter } from '@/components/home/group-filter'
import { getEventsForMonth } from '@/lib/events/queries'
import { getAnniversariesForMonth } from '@/lib/events/anniversaries'
import { getGroups } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { kstDayKey } from '@/lib/events/date'
import { parseTypesParam } from '@/lib/events/filters'
import { groupMusicShowEpisodes } from '@/lib/events/grouping'
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
  searchParams: Promise<{ month?: string; group?: string; type?: string; scope?: string }>
}) {
  const sp = await searchParams
  const { year, month } = parseMonth(sp.month)
  const explicitSlugs = sp.group ? sp.group.split(',').filter(Boolean) : undefined
  const types = parseTypesParam(sp.type)
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

  const [groups, followedIds] = await Promise.all([getGroups(), getFollowedGroupIds()])
  const followedSlugs = groups.filter((g) => followedIds.has(g.id)).map((g) => g.slug)
  // Portée MY GROUPS (§7.2) : restreint aux groupes suivis quand aucun filtre
  // de groupe explicite n'est posé.
  const groupSlugs =
    explicitSlugs ?? (sp.scope === 'mine' && followedSlugs.length > 0 ? followedSlugs : undefined)

  const [dbEvents, anniversaries] = await Promise.all([
    getEventsForMonth({ year, month, groupSlugs, types }),
    wantAnniversaries ? getAnniversariesForMonth({ year, month, groupSlugs }) : Promise.resolve([]),
  ])
  // Groupement music shows par épisode : compteur FilterChips et cellules du
  // mois comptent des cartes, pas des lignes brutes.
  const events = groupMusicShowEpisodes(
    [...dbEvents, ...anniversaries].sort((a, b) => a.start_at.localeCompare(b.start_at)),
  )

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-4 md:px-4 md:py-6">
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
        <div className="order-1 min-w-0 flex-1 space-y-3 lg:order-2">
          <FilterChips eventCount={events.length} isAuthed={Boolean(user)} />
          <CalendarMonth year={year} month={month} events={events} />
        </div>
        <aside className="order-3 shrink-0 lg:w-80">
          <SidebarRight />
        </aside>
      </div>
    </div>
  )
}
