import { notFound, redirect } from 'next/navigation'
import { EventList } from '@/components/event-list'
import { FollowButton } from '@/components/follow-button'
import { ArtistHero } from '@/components/group/artist-hero'
import { CollapsibleMvs } from '@/components/group/collapsible-mvs'
import { LinksBar } from '@/components/group/links-bar'
import { MembersGrid } from '@/components/member/members-grid'
import { getGroupBySlug } from '@/lib/groups/queries'
import { getUpcomingEvents, getGroupMvs } from '@/lib/events/queries'
import { getRatingsForEvents } from '@/lib/events/community'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getMembersForGroup, getSoloMemberSlugByGroupId } from '@/lib/members/queries'
import { faceCrop } from '@/lib/images/cloudinary'
import { createClient } from '@/lib/supabase/server'

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const group = await getGroupBySlug(slug)
  if (!group) notFound()

  if (group.is_solo) {
    const memberSlug = await getSoloMemberSlugByGroupId(group.id)
    if (memberSlug) redirect(`/artists/${memberSlug}`)
  }

  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    events,
    mvs,
    followedIds,
    members,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getUpcomingEvents({ groupSlug: slug, limit: 10 }),
    getGroupMvs(slug, 48),
    getFollowedGroupIds(),
    getMembersForGroup(group.id),
  ])
  const ratings = await getRatingsForEvents(mvs.map((m) => m.id))
  const activeMembers = members.filter((m) => m.status === 'active')
  const inactiveMembers = members.filter((m) => m.status !== 'active')

  const bannerSrc =
    group.banner_url ??
    group.image_landscape ??
    (group.image_url ? faceCrop(group.image_url, 1600, 500) : null)

  const links = group.links as Record<string, string> | null

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-6">
        <ArtistHero
          name={group.name}
          image={bannerSrc}
          follow={
            <FollowButton
              groupId={group.id}
              initialFollowing={followedIds.has(group.id)}
              isAuthed={!!user}
              iconOnly
              large
            />
          }
        />

        {/* Infos + liens */}
        <div className="space-y-3">
          {group.agency && <p className="text-muted-foreground text-sm">{group.agency}</p>}
          <LinksBar links={links} />
        </div>

        {/* Membres */}
        {activeMembers.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Members ({activeMembers.length})</h2>
            <MembersGrid members={activeMembers} groupColorHex={group.color_hex} />
          </section>
        )}
        {inactiveMembers.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Former &amp; pre-debut</h2>
            <MembersGrid members={inactiveMembers} groupColorHex={group.color_hex} />
          </section>
        )}

        {/* Events */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Upcoming events</h2>
          <EventList events={events} emptyMessage="No upcoming events." />
        </section>

        {/* MVs */}
        {mvs.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Music videos ({mvs.length})</h2>
            <CollapsibleMvs mvs={mvs} ratings={ratings} />
          </section>
        )}
      </div>
    </div>
  )
}
