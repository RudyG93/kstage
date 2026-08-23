import { cache, Suspense } from 'react'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'
import { FollowButton } from '@/components/follow-button'
import { QueueRow } from '@/components/events/queue-row'
import { ArtistHero } from '@/components/group/artist-hero'
import { StatsStrip, type StatCell } from '@/components/group/stats-strip'
import { MvCard } from '@/components/group/mv-card'
import { MembersGrid } from '@/components/member/members-grid'
import { getGroupBySlug, getGroupFollowCounts } from '@/lib/groups/queries'
import { StageCard } from '@/components/group/stage-card'
import {
  getUpcomingEvents,
  getGroupMvs,
  getGroupStages,
  getLastReleaseForGroup,
  getLatestShowWin,
} from '@/lib/events/queries'
import { getUpcomingAnniversaries } from '@/lib/events/anniversaries'
import { getRatingsForEvents } from '@/lib/events/community'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getMembersForGroup, getSoloMemberSlugByGroupId } from '@/lib/members/queries'
import { formatDDay, isFutureDate, monthYear } from '@/lib/events/date'
import { getViewerTimeZone } from '@/lib/profiles/timezone'
import { groupBannerSrc } from '@/lib/groups/banner'
import { JsonLd } from '@/components/seo/json-ld'
import { Breadcrumbs } from '@/components/seo/breadcrumbs'
import { SHOW_ID_BY_TITLE } from '@/lib/scrapers/music-shows/types'
import { PageRails } from '@/components/layout/page-rails'
import { RailStack } from '@/components/rails/rail-stack'
import { DebutClassBlock, SpotlightBlock } from '@/components/rails/discovery-blocks'
import { getViewer } from '@/lib/supabase/viewer'
import { SITE_URL } from '@/lib/site'
import { compactNumber } from '@/lib/utils'

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
  const [dbEvents, stages, anniversaries, mvs, members, followCounts] = await Promise.all([
    getUpcomingEvents({ groupSlug: slug, limit: 20 }),
    getGroupStages(slug),
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
  return {
    timeZone,
    events,
    stages: stages.rows,
    stageTotal: stages.total,
    mvs: mvs.rows,
    mvTotal: mvs.total,
    members,
    followCounts,
  }
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

/** `/show/m-countdown/2026-08-20` depuis une row show_episodes. */
function episodeHrefOf(win: { show_title: string; kst_day: string }): string {
  return `/show/${SHOW_ID_BY_TITLE[win.show_title] ?? ''}/${win.kst_day}`
}

/** 1st, 2nd, 3rd, 4th… — 11/12/13 font exception. */
function ordinalWin(n: number): string {
  const m100 = n % 100
  if (m100 >= 11 && m100 <= 13) return `${n}th`
  const m10 = n % 10
  return `${n}${m10 === 1 ? 'st' : m10 === 2 ? 'nd' : m10 === 3 ? 'rd' : 'th'}`
}

/** En dessous, une moyenne n'est pas une information : c'est l'avis d'une
    personne présenté comme un score (2 notes en base au 2026-08-22). */
const MIN_VOTES_FOR_AVG = 3

/** Corps (stats, membres, events, MVs) — streamé après le hero (Lot G). */
async function GroupBody({ group }: { group: Group }) {
  const { timeZone, events, stages, stageTotal, mvs, mvTotal, members, followCounts } =
    await getGroupPageData(group.slug, group.id)
  const [ratings, { profile: viewerProfile }, lastDrop, latestWin] = await Promise.all([
    getRatingsForEvents(mvs.map((m) => m.id)),
    getViewer(),
    getLastReleaseForGroup(group.id),
    getLatestShowWin(group.id),
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
  const avgScore = totalVotes >= MIN_VOTES_FOR_AVG ? weightedSum / totalVotes : null

  // Cellules de la strip : uniquement celles qui ont une valeur. Un « 0
  // Followers » ou un « — Avg score » sur Seventeen dit au premier visiteur
  // que personne n'est là — la règle du BACKLOG (« un compteur à zéro est une
  // anti-preuve sociale ») vaut aussi pour les surfaces déjà livrées.
  //
  // ORDRE = valeur informative décroissante, parce que la strip tronque à
  // MAX_CELLS : la cellule sacrifiée doit être la moins utile. « Upcoming »
  // passe donc en dernier — la section « Upcoming » est rendue 300 px plus
  // bas sur la même page. « Avg score » est rare et mérité, il ne doit pas
  // être celui qu'on coupe.
  //
  // Fuseau du VIEWER, comme les dates des vignettes MV juste en dessous : en
  // KST, une sortie du 1er mars à 00:00 s'affichait « MAR » ici et « FEB »
  // sur la carte, pour le même clip.
  const stats: StatCell[] = []
  if (lastDrop) stats.push({ value: monthYear(lastDrop, timeZone), label: 'Last drop' })
  if (avgScore !== null) stats.push({ value: avgScore.toFixed(1), label: 'Avg score' })
  if (followers > 0) stats.push({ value: compactNumber(followers), label: 'Followers' })
  if (events.length > 0) stats.push({ value: String(events.length), label: 'Upcoming' })

  return (
    <div className="space-y-3 px-3 md:px-0">
      <StatsStrip stats={stats} links={links} />

      {/* Dernière victoire en music show — la monnaie du fandom, et la seule
          donnée de la page qui vienne d'une source tierce sourcée. Une ligne,
          pas un compteur cumulé : le rang est celui de Wikipedia. */}
      {latestWin?.winner_nth != null && (
        <Link
          href={episodeHrefOf(latestWin) as Route}
          className="border-amber/25 bg-amber/[0.06] hover:border-amber/50 flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors"
        >
          <Trophy className="text-amber size-4 shrink-0" strokeWidth={2} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-xs">
            <span className="font-semibold">
              {ordinalWin(latestWin.winner_nth)} win — {latestWin.show_title}
            </span>
            {latestWin.winner_song && (
              <span className="text-muted-foreground"> · {latestWin.winner_song}</span>
            )}
          </span>
          <span className="tabular text-muted-foreground shrink-0 text-[11px]">
            {monthYear(`${latestWin.kst_day}T00:00:00Z`, 'UTC')}
          </span>
        </Link>
      )}

      {/* Ordre Members > Former > Upcoming > MVs (retours Rudy 2026-07-12
          et 13) : les visages d'abord — anciens membres juste sous les
          actuels, pas relégués en fond de page. */}
      {activeMembers.length > 0 && (
        <section className="space-y-2">
          <h2 className="label-data">Members — {activeMembers.length}</h2>
          <MembersGrid
            members={activeMembers}
            groupColorHex={group.color_hex}
            biasMemberId={biasMemberId}
          />
        </section>
      )}

      {memorialMembers.length > 0 && (
        <section className="space-y-2">
          <h2 className="label-data">In memoriam</h2>
          <MembersGrid members={memorialMembers} groupColorHex={group.color_hex} />
        </section>
      )}

      {inactiveMembers.length > 0 && (
        <section className="space-y-2">
          <h2 className="label-data">Former & pre-debut</h2>
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
          <h2 className="label-data">MVs — {mvTotal}</h2>
          <div className="grid grid-cols-2 gap-[9px] sm:grid-cols-3 md:grid-cols-4">
            {mvs.map((mv) => (
              <MvCard key={mv.id} mv={mv} rating={ratings.get(mv.id)} timeZone={timeZone} />
            ))}
          </div>
          {/* Le compteur dit le total, la grille est plafonnée : le dire, plutôt
              que de laisser croire que la page montre tout. */}
          {mvTotal > mvs.length && (
            <p className="text-muted-foreground text-[11px]">
              Showing the {mvs.length} most recent.
            </p>
          )}
        </section>
      )}

      {/* Passages music-show diffusés (2026-08-21). Ces lignes existaient sans
          surface : la page ne montrait que l'À VENIR, donc une scène diffusée
          n'était atteignable que par le calendrier, à la bonne date — IDID
          avait 24 passages, tous avec vidéo, et une page qui semblait vide. */}
      {stages.length > 0 && (
        <section className="space-y-2">
          <h2 className="label-data">Stages — {stageTotal}</h2>
          <div className="grid grid-cols-2 gap-[9px] sm:grid-cols-3 md:grid-cols-4">
            {stages.map((stage) => (
              <StageCard key={stage.id} stage={stage} timeZone={timeZone} />
            ))}
          </div>
          {stageTotal > stages.length && (
            <p className="text-muted-foreground text-[11px]">
              Showing the {stages.length} most recent.
            </p>
          )}
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
    <PageRails
      // Rail contextuel (Lot 6) : spotlight (sans le groupe courant — jamais
      // de lien vers soi-même) + discussions, au lieu du rail générique.
      right={
        <RailStack>
          <SpotlightBlock excludeSlug={group.slug} />
          <DebutClassBlock debutDate={group.debut_date} excludeId={group.id} />
        </RailStack>
      }
    >
      <Breadcrumbs
        trail={[
          { name: 'Home', path: '/' },
          { name: 'Groups', path: '/groups' },
          { name: group.name, path: `/groups/${group.slug}` },
        ]}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'MusicGroup',
          name: group.name,
          url: `${SITE_URL}/groups/${group.slug}`,
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
