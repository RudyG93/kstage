import { notFound } from 'next/navigation'
import { EventList } from '@/components/event-list'
import { getGroupBySlug } from '@/lib/groups/queries'
import { getUpcomingEvents } from '@/lib/events/queries'

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const group = await getGroupBySlug(slug)
  if (!group) notFound()

  const events = await getUpcomingEvents({ groupSlug: slug, limit: 100 })
  const subtitle = [group.agency, group.fandom_name].filter(Boolean).join(' · ')

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span
          className="size-4 shrink-0 rounded-full"
          style={{ backgroundColor: group.color_hex ?? 'var(--muted-foreground)' }}
          aria-hidden
        />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </div>
      </header>
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Upcoming events</h2>
        <EventList events={events} emptyMessage="No upcoming events." />
      </section>
    </div>
  )
}
