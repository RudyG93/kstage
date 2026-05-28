import { notFound } from 'next/navigation'
import { EventList } from '@/components/event-list'
import { FollowButton } from '@/components/follow-button'
import { MvsGrid } from '@/components/group/mvs-grid'
import { getGroupBySlug } from '@/lib/groups/queries'
import { getUpcomingEvents, getGroupMvs } from '@/lib/events/queries'
import { getRatingsForEvents } from '@/lib/events/community'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { createClient } from '@/lib/supabase/server'

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const group = await getGroupBySlug(slug)
  if (!group) notFound()

  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    events,
    mvs,
    followedIds,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getUpcomingEvents({ groupSlug: slug, limit: 100 }),
    getGroupMvs(slug, 24),
    getFollowedGroupIds(),
  ])
  const ratings = await getRatingsForEvents(mvs.map((m) => m.id))
  const subtitle = [group.agency, group.fandom_name].filter(Boolean).join(' · ')

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <span
            className="size-4 shrink-0 rounded-full"
            style={{ backgroundColor: group.color_hex ?? 'var(--muted-foreground)' }}
            aria-hidden
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
            {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
          </div>
          <FollowButton
            groupId={group.id}
            initialFollowing={followedIds.has(group.id)}
            isAuthed={!!user}
            className="ml-auto shrink-0"
          />
        </header>
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Upcoming events</h2>
          <EventList events={events} emptyMessage="No upcoming events." />
        </section>
        {mvs.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Music videos ({mvs.length})</h2>
            <MvsGrid mvs={mvs} ratings={ratings} />
          </section>
        )}
      </div>
    </div>
  )
}
