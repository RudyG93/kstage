import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { FollowButton } from '@/components/follow-button'
import { QueueRow } from '@/components/events/queue-row'
import { ArtistHero } from '@/components/group/artist-hero'
import { StatsStrip } from '@/components/group/stats-strip'
import { MvScrollRow } from '@/components/mv/mv-scroll-row'
import { MembersGrid } from '@/components/member/members-grid'
import { SuggestEventDialog } from '@/components/suggestions/suggest-event-dialog'
import { getGroupBySlug } from '@/lib/groups/queries'
import { getUpcomingEvents, getGroupMvs } from '@/lib/events/queries'
import { getUpcomingAnniversaries } from '@/lib/events/anniversaries'
import { getRatingsForEvents } from '@/lib/events/community'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getMembersForGroup, getSoloMemberSlugByGroupId } from '@/lib/members/queries'
import { formatDDay } from '@/lib/events/date'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { faceCrop } from '@/lib/images/cloudinary'
import { JsonLd } from '@/components/seo/json-ld'
import { createClient } from '@/lib/supabase/server'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const group = await getGroupBySlug(slug)
  if (!group) return {}
  const title = `${group.name} — comebacks & schedule`
  const description = `Upcoming events, comebacks, MVs and member birthdays for ${group.name} on KStage.`
  return {
    title,
    description,
    alternates: { canonical: `/groups/${slug}` },
    openGraph: { title: `${title} · KStage`, description, url: `/groups/${slug}` },
  }
}

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
    dbEvents,
    anniversaries,
    mvs,
    followedIds,
    members,
    { data: countRows },
  ] = await Promise.all([
    supabase.auth.getUser(),
    getUpcomingEvents({ groupSlug: slug, limit: 20 }),
    getUpcomingAnniversaries([group.id], 90),
    getGroupMvs(slug, 48),
    getFollowedGroupIds(),
    getMembersForGroup(group.id),
    supabase.rpc('group_follow_counts'),
  ])
  // Anniversaires des membres fusionnés au flux : une page groupe sans event
  // programmé n'est pas un dead-end (contenu plancher P0.6).
  const events = [...dbEvents, ...anniversaries].sort((a, b) =>
    a.start_at.localeCompare(b.start_at),
  )
  const ratings = await getRatingsForEvents(mvs.map((m) => m.id))
  const activeMembers = members.filter((m) => m.status === 'active')
  const inactiveMembers = members.filter((m) => m.status !== 'active')

  // Bias du viewer → ring dorée dans le rail membres (§7.6.5).
  let biasMemberId: string | null = null
  if (user) {
    const { data: viewerProfile } = await supabase
      .from('profiles')
      .select('bias_member_id')
      .eq('id', user.id)
      .maybeSingle()
    biasMemberId = viewerProfile?.bias_member_id ?? null
  }

  // Hero : le thumbnail du DERNIER MV principal passe AVANT image_landscape —
  // les fanarts TheAudioDB sont des seeds figés (aespa servait un visuel 2021,
  // reproche Rudy 2026-07-11) alors que le dernier MV est l'ère en cours. Même
  // logique que le hero home (next-drop-card). hqdefault : servie pour TOUTE
  // vidéo (maxres 404 sur certaines), suffisante en object-cover.
  const latestMainMv = mvs.find((m) => m.mv_kind === 'main') ?? mvs[0]
  const latestMvId = latestMainMv ? extractYouTubeId(latestMainMv.source_url) : null
  const bannerSrc =
    group.banner_url ??
    (latestMvId ? `https://i.ytimg.com/vi/${latestMvId}/hqdefault.jpg` : null) ??
    group.image_landscape ??
    (group.image_url ? faceCrop(group.image_url, 1600, 500) : null)

  const links = group.links as Record<string, string> | null
  const followers = (countRows ?? []).find((r) => r.group_id === group.id)?.follows ?? 0

  // Avg score du catalogue MV (moyenne pondérée par le nombre de votes).
  let weightedSum = 0
  let totalVotes = 0
  for (const { avg, count } of ratings.values()) {
    weightedSum += avg * count
    totalVotes += count
  }
  const avgScore = totalVotes > 0 ? weightedSum / totalVotes : null

  // Prochain comeback (mv/release) → tag D-day de la bannière + carte annoncée.
  const nextComeback = events.find((e) => e.type === 'mv' || e.type === 'release')
  const debutYear = group.debut_date ? new Date(group.debut_date).getUTCFullYear() : null
  const metaParts = [
    group.agency,
    debutYear ? `debut ${debutYear}` : null,
    activeMembers.length > 0 ? `${activeMembers.length} members` : null,
  ].filter(Boolean)

  return (
    <div className="mx-auto w-full max-w-3xl md:px-4 md:py-6">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'MusicGroup',
          name: group.name,
          url: `https://kstage.vercel.app/groups/${group.slug}`,
          genre: 'K-pop',
          ...(group.image_url ? { image: group.image_url } : {}),
          ...(group.debut_date ? { foundingDate: group.debut_date } : {}),
          ...(links && Object.values(links).length > 0 ? { sameAs: Object.values(links) } : {}),
        }}
      />
      <div className="space-y-3">
        <ArtistHero
          name={group.name}
          image={bannerSrc}
          colorHex={group.color_hex}
          tags={
            <>
              <span className="label-data-inline bg-page/50 rounded-[4px] px-1.5 py-0.5 text-[8.5px] backdrop-blur-sm">
                Group
              </span>
              {nextComeback && (
                <span className="label-data-inline bg-page/50 text-primary rounded-[4px] px-1.5 py-0.5 text-[8.5px] backdrop-blur-sm">
                  Comeback {formatDDay(nextComeback.start_at, 'Asia/Seoul')}
                </span>
              )}
            </>
          }
          meta={metaParts.join(' · ') || null}
          follow={
            <FollowButton
              groupId={group.id}
              initialFollowing={followedIds.has(group.id)}
              isAuthed={!!user}
              pill
            />
          }
        />

        <div className="space-y-3 px-3 md:px-0">
          <StatsStrip
            followers={followers}
            upcoming={events.length}
            avgScore={avgScore}
            links={links}
          />

          {/* Events */}
          <Panel>
            <PanelHeader
              label={`Upcoming — ${group.name}`}
              action={{ label: 'Calendar', href: `/calendar?group=${slug}` }}
            />
            {events.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  title="No upcoming events"
                  description="Nothing scheduled yet. Browse this group's MVs below, or check the calendar."
                  action={{ label: 'Open calendar', href: `/calendar?group=${slug}` }}
                />
              </div>
            ) : (
              <div className="divide-y">
                {events.slice(0, 8).map((event) => (
                  <QueueRow key={event.id} event={event} />
                ))}
              </div>
            )}
            {user && (
              <div className="flex justify-end border-t px-3 py-2">
                <SuggestEventDialog groups={[{ id: group.id, name: group.name }]} />
              </div>
            )}
          </Panel>

          {/* MVs */}
          {mvs.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="label-data">MVs — {mvs.length}</span>
              </div>
              <MvScrollRow title={`${group.name} MVs`} href={`/mvs`} mvs={mvs} ratings={ratings} />
            </section>
          )}

          {/* Membres */}
          {activeMembers.length > 0 && (
            <section className="space-y-2">
              <span className="label-data">Members — {activeMembers.length}</span>
              <MembersGrid
                members={activeMembers}
                groupColorHex={group.color_hex}
                biasMemberId={biasMemberId}
              />
            </section>
          )}
          {inactiveMembers.length > 0 && (
            <section className="space-y-2">
              <span className="label-data">Former & pre-debut</span>
              <MembersGrid members={inactiveMembers} groupColorHex={group.color_hex} />
            </section>
          )}

          {events.length >= 20 && (
            <Link
              href={`/calendar?group=${slug}`}
              className="text-muted-foreground hover:text-foreground inline-block text-xs underline underline-offset-4"
            >
              See all on calendar
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
