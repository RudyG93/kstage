import { FilterBar } from '@/components/filter-bar'
import { CalendarMonth } from '@/components/calendar-month'
import { getEventsForMonth } from '@/lib/events/queries'
import { getGroups } from '@/lib/groups/queries'
import { kstDayKey } from '@/lib/events/date'
import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

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
  const [groups, events] = await Promise.all([
    getGroups(),
    getEventsForMonth({
      year,
      month,
      groupSlug: sp.group,
      type: sp.type as EventType | undefined,
    }),
  ])

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <FilterBar groups={groups} />
        <CalendarMonth year={year} month={month} events={events} />
      </div>
    </div>
  )
}
