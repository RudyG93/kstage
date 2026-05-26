import { FilterBar } from '@/components/filter-bar'
import { GroupedEventList } from '@/components/grouped-event-list'
import { getUpcomingEvents } from '@/lib/events/queries'
import { getGroups } from '@/lib/groups/queries'
import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; type?: string }>
}) {
  const { group, type } = await searchParams
  const [groups, events] = await Promise.all([
    getGroups(),
    getUpcomingEvents({ groupSlug: group, type: type as EventType | undefined }),
  ])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Upcoming</h1>
        <p className="text-muted-foreground text-sm">
          Comebacks, music shows and lives from your favorite groups.
        </p>
      </div>
      <FilterBar groups={groups} />
      <GroupedEventList events={events} emptyMessage="No upcoming events match these filters." />
    </div>
  )
}
