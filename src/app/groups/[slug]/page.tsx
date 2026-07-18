import { cache, Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'
import { FollowButton } from '@/components/follow-button'
import { QueueRow } from '@/components/events/queue-row'
import { ArtistHero } from '@/components/group/artist-hero'
import { StatsStrip } from '@/components/group/stats-strip'
import { MvCard } from '@/components/group/mv-card'
import { MembersGrid } from '@/components/member/members-grid'
import { getGroupBySlug, getGroupFollowCounts } from '@/lib/groups/queries'
import { getUpcomingEvents, getGroupMvs } from '@/lib/events/queries'
import { getUpcomingAnniversaries } from '@/lib/events/anniversaries'
import { getRatingsForEvents } from '@/lib/events/community'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getMembersForGroup, getSoloMemberSlugByGroupId } from '@/lib/members/queries'
import { formatDDay, isFutureDate } from '@/lib/events/date'
import { getViewerTimeZone } from '@/lib/profiles/timezone'
import { groupBannerSrc } from '@/lib/groups/banner'
import { JsonLd } from '@/components/seo/json-ld'
import { PageRails } from '@/components/layout/page-rails'
import { getViewer } from '@/lib/supabase/viewer'

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
    // Pré-debut (R4-I) : page atteignable (calendrier/follow) mais hors index
    // tant que le groupe n'a pas de contenu — cohérent avec le page-pruning.
    // + tier `candidate` (Phase 3 Lot 2) : identité encore ambiguë → jamais
    // indexée (audit §4.1 « Non ou noindex »), sitemap aligné.
    ...(isFutureDate(group.debut_date) || group.confidence === 'candidate'
      ? { robots: { index: false, follow: true } }
      : {}),
  }
}

type Group = NonNullable<Awaited<ReturnType<typeof getGroupBySlug>>>

// Données du corps de page, partagées entre les sections streamées (chip
// comeback du hero, stats, listes) — cache() dédoublonne par args (Lot G).
const getGroupPageData = cache(async (slug: string, groupId: string) => {
  const timeZone = await getViewerTimeZone()
  const [dbEvents, anniversaries, mvs, members, followCounts] = await Promise.all([
    getUpcomingEvents({ groupSlug: slug, limit: 20 }),
    getUpcomingAnniversaries([groupId], 90, timeZone),
    getGroupMvs(slug, 48),
    getMembersForGroup(groupId),
    getGroupFollowCounts(),
  ])
  // Anniversaires des membres fusionnés au flux : une page groupe sans event
  // programmé n'est pas un dead-end (contenu plancher P0.6).
  const events = [...dbEvents, ...anniversaries].sort((a, b) =>
    a.start_at.localeCompare(b.start_at),
  )
  return { timeZone, events, mvs, members, followCounts }
})

/** Chip « Comeback D-x » du hero — dépend des events, streamé dans le slot. */
async function ComebackTag({ group }: { group: Group }) {
  const { events, timeZone } = await getGroupPageData(group.slug, group.id)
  const nextComeback = events.find((e) => e.type === 'mv' || e.type === 'release')
  if (!nextComeback) return null
  return (
    <span className="label-data-inline bg-page/50 text-primary rounded-[4px] px-1.5 py-0.5 text-[9px] backdrop-blur-sm">
      Comeback {formatDDay(nextComeback.start_at, timeZone)}
    </span>
  )
}

/** Méta du hero : la partie statique s'affiche direct, le compte de membres
 * la complète au stream (fallback = agency · debut seuls). */
async function HeroMeta({ group, staticMeta }: { group: Group; staticMeta: string | null }) {
  const { members } = await getGroupPageData(group.slug, group.id)
  const activeCount = members.filter((m) => m.status === 'active').length
  const parts = [staticMeta, activeCount > 0 ? `${activeCount} members` : null].filter(Boolean)
  return <>{parts.join(' · ') || null}</>
}

/** Bouton Follow du hero — dépend du viewer, streamé dans le slot. */
async function GroupFollow({ group }: { group: Group }) {
  const [{ user }, followedIds] = await Promise.all([getViewer(), getFollowedGroupIds()])
  return (
    <FollowButton
      groupId={group.id}
      initialFollowing={followedIds.has(group.id)}
      isAuthed={!!user}
      pill
    />
  )
}

function GroupBodySkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  )
}

/** Corps (stats, membres, events, MVs) — streamé après le hero (Lot G). */
async function GroupBody({ group }: { group: Group }) {
  const { timeZone, events, mvs, members, followCounts } = await getGroupPageData(
    group.slug,
    group.id,
  )
  const [ratings, { profile: viewerProfile }] = await Promise.all([
    getRatingsForEvents(mvs.map((m) => m.id)),
    getViewer(),
  ])
  const slug = group.slug
  const activeMembers = members.filter((m) => m.status === 'active')
  // Décédés : section « In memoriam » dédiée (jamais rangés sous « Former » ni
  // grisés). Le compteur « Members » reste sur les actifs seuls.
  const memorialMembers = members.filter((m) => m.status === 'deceased')
  const inactiveMembers = members.filter((m) => m.status !== 'active' && m.status !== 'deceased')

  // Bias du viewer → ring dorée dans le rail membres (§7.6.5).
  const biasMemberId = viewerProfile?.bias_member_id ?? null

  const links = group.links as Record<string, string> | null
  const followers = followCounts.get(group.id) ?? 0

  // Avg score du catalogue MV (moyenne pondérée par le nombre de votes).
  let weightedSum = 0
  let totalVotes = 0
  for (const { avg, count } of ratings.values()) {
    weightedSum += avg * count
    totalVotes += count
  }
  const avgScore = totalVotes > 0 ? weightedSum / totalVotes : null

  return (
    <div className="space-y-3 px-3 md:px-0">
      <StatsStrip
        followers={followers}
        upcoming={events.length}
        avgScore={avgScore}
        links={links}
      />

      {/* Ordre Members > Former > Upcoming > MVs (retours Rudy 2026-07-12
          et 13) : les visages d'abord — anciens membres juste sous les
          actuels, pas relégués en fond de page. */}
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

      {memorialMembers.length > 0 && (
        <section className="space-y-2">
          <span className="label-data">In memoriam</span>
          <MembersGrid members={memorialMembers} groupColorHex={group.color_hex} />
        </section>
      )}

      {inactiveMembers.length > 0 && (
        <section className="space-y-2">
          <span className="label-data">Former & pre-debut</span>
          <MembersGrid members={inactiveMembers} groupColorHex={group.color_hex} />
        </section>
      )}

      {/* Events */}
      <Panel>
        {/* Contribute retiré (R4-E) : signaler une donnée manquante passe
            par le widget Feedback du footer (catégorie Data). Lien
            Calendar au niveau du header (R5) — plus de ligne footer. */}
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
              <QueueRow key={event.id} event={event} timeZone={timeZone} />
            ))}
          </div>
        )}
      </Panel>

      {/* MVs : grille complète (fin du rail horizontal + « See more » —
          la place existe, autant tout montrer ; retour Rudy 2026-07-12). */}
      {mvs.length > 0 && (
        <section className="space-y-2">
          <span className="label-data">MVs — {mvs.length}</span>
          <div className="grid grid-cols-2 gap-[9px] sm:grid-cols-3 md:grid-cols-4">
            {mvs.map((mv) => (
              <MvCard key={mv.id} mv={mv} rating={ratings.get(mv.id)} timeZone={timeZone} />
            ))}
          </div>
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
  )
}

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // Lot G — invariant soft-404 : le SEUL await bloquant est ce check
  // d'existence (mémoïsé, partagé avec generateMetadata) + le redirect solo.
  // notFound()/redirect() tombent AVANT tout streaming.
  const group = await getGroupBySlug(slug)
  if (!group) notFound()

  if (group.is_solo) {
    const memberSlug = await getSoloMemberSlugByGroupId(group.id)
    if (memberSlug) redirect(`/artists/${memberSlug}`)
  }

  // Hero : chaîne bannière unifiée (R4-B) — banner_yt_url (2560px, rafraîchie
  // par les labels à chaque ère) remplace le hqdefault 480px flou du dernier
  // MV et les fanarts TheAudioDB figés.
  const bannerSrc = groupBannerSrc(group)
  const links = group.links as Record<string, string> | null
  const debutYear = group.debut_date ? new Date(group.debut_date).getUTCFullYear() : null
  const staticMeta =
    [group.agency, debutYear ? `debut ${debutYear}` : null].filter(Boolean).join(' · ') || null

  return (
    <PageRails>
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
        {/* SHELL : le hero peint immédiatement depuis la row groupe ; les
            morceaux dépendants (chip comeback, méta complète, follow) streament
            dans leurs slots (Lot G). */}
        <ArtistHero
          name={group.name}
          image={bannerSrc}
          colorHex={group.color_hex}
          tags={
            <>
              <span className="label-data-inline bg-page/50 rounded-[4px] px-1.5 py-0.5 text-[9px] backdrop-blur-sm">
                Group
              </span>
              {isFutureDate(group.debut_date) && (
                <span className="label-data-inline bg-page/50 text-primary rounded-[4px] px-1.5 py-0.5 text-[9px] backdrop-blur-sm">
                  Pre-debut
                </span>
              )}
              {group.disbanded_on && (
                <span className="label-data-inline bg-page/50 text-muted-foreground rounded-[4px] px-1.5 py-0.5 text-[9px] backdrop-blur-sm">
                  Disbanded {new Date(group.disbanded_on).getUTCFullYear()}
                </span>
              )}
              <Suspense fallback={null}>
                <ComebackTag group={group} />
              </Suspense>
            </>
          }
          meta={
            <Suspense fallback={staticMeta}>
              <HeroMeta group={group} staticMeta={staticMeta} />
            </Suspense>
          }
          follow={
            <Suspense fallback={null}>
              <GroupFollow group={group} />
            </Suspense>
          }
        />

        <Suspense fallback={<GroupBodySkeleton />}>
          <GroupBody group={group} />
        </Suspense>
      </div>
    </PageRails>
  )
}
