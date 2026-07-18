import { cache, Suspense } from 'react'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { faceCrop } from '@/lib/images/cloudinary'
import { getViewer } from '@/lib/supabase/viewer'
import {
  getEventBySlug,
  getEventRatingSummary,
  getLikeSummary,
  getRatingsForEvents,
} from '@/lib/events/community'
import { getCommentsForEvent } from '@/lib/comments/queries'
import { buildCommentTree, sortTree, type SortMode } from '@/lib/comments/tree'
import { getGroupMvs } from '@/lib/events/queries'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { displaySongTitle } from '@/lib/events/title'
import { getViewerTimeZone } from '@/lib/profiles/timezone'
import { BackButton } from '@/components/back-button'
import { JsonLd } from '@/components/seo/json-ld'
import { Panel } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'
import { YouTubeEmbed } from '@/components/mv/youtube-embed'
import { RatingSlider } from '@/components/mv/rating-slider'
import { RatingHistogram } from '@/components/mv/rating-histogram'
import { LikeButton } from '@/components/mv/like-button'
import { MvCard } from '@/components/group/mv-card'
import { MvRightRail } from '@/components/mv/mv-right-rail'
import { PageRails } from '@/components/layout/page-rails'
import { SidebarRight } from '@/components/home/sidebar-right'
import { CommentSection } from '@/components/mv/comments/comment-section'

async function loadMv(slug: string) {
  const event = await getEventBySlug(slug)
  if (!event || event.type !== 'mv' || !event.slug) return null
  return event
}

type LoadedMv = NonNullable<Awaited<ReturnType<typeof loadMv>>>

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const event = await loadMv(slug)
  if (!event) return { title: 'MV not found · KStage' }
  const group = event.groups
  const title = displaySongTitle(event.title, group?.name)
  const description = event.description ?? `${group?.name} music video.`
  return {
    title: `${title} — ${group?.name ?? 'KStage'}`,
    description,
    alternates: { canonical: `/mv/${slug}` },
    openGraph: { title: `${title} — ${group?.name ?? 'KStage'}`, description },
    // Tier `candidate` (Phase 3 Lot 2) : les MVs d'une identité encore ambiguë
    // ne s'indexent pas — cohérent avec la page groupe et le sitemap.
    ...(group?.confidence === 'candidate' ? { robots: { index: false, follow: true } } : {}),
  }
}

// Catalogue du groupe (rail droit desktop + grille mobile) : fetch UNIQUE
// partagé entre les deux sections streamées — cache() dédoublonne par args.
const getRailData = cache(async (groupSlug: string, excludeId: string) => {
  const groupMvs = await getGroupMvs(groupSlug, 9)
  const railMvs = groupMvs.filter((m) => m.id !== excludeId)
  const ratings = await getRatingsForEvents(railMvs.map((m) => m.id))
  return { railMvs, ratings }
})

/** Rail droit streamé — catalogue du groupe, repli SidebarRight si vide. */
async function MvRail({
  groupSlug,
  groupName,
  excludeId,
}: {
  groupSlug: string
  groupName: string
  excludeId: string
}) {
  const [{ railMvs, ratings }, timeZone] = await Promise.all([
    getRailData(groupSlug, excludeId),
    getViewerTimeZone(),
  ])
  if (railMvs.length === 0) return <SidebarRight />
  return (
    <MvRightRail
      groupName={groupName}
      groupSlug={groupSlug}
      mvs={railMvs.slice(0, 9)}
      ratings={ratings}
      timeZone={timeZone}
    />
  )
}

function MvBodySkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-44" />
      <Skeleton className="h-36 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  )
}

/**
 * Corps de la page (Lot G 2026-07-18) : tout ce qui dépend du viewer ou de
 * données lourdes (notes, like, commentaires, catalogue) — streamé sous
 * Suspense APRÈS que le shell (player) a peint. Le statut HTTP est déjà
 * décidé (loadMv + notFound dans la page) : pas de soft-404 possible.
 */
async function MvBody({
  event,
  videoId,
  title,
  slug,
  sort,
}: {
  event: LoadedMv
  videoId: string | null
  title: string
  slug: string
  sort: SortMode
}) {
  const group = event.groups
  const { user: viewer } = await getViewer()
  const viewerId = viewer?.id ?? null
  const isAuthed = viewer != null

  const [rating, like, flatComments, timeZone, railData] = await Promise.all([
    getEventRatingSummary(event.id),
    getLikeSummary(event.id, viewerId),
    getCommentsForEvent(event.id, viewerId),
    getViewerTimeZone(),
    group?.slug
      ? getRailData(group.slug, event.id)
      : Promise.resolve({
          railMvs: [],
          ratings: new Map<string, { avg: number; count: number }>(),
        }),
  ])
  const commentRoots = sortTree(buildCommentTree(flatComments), sort)
  // « More from {group} » : grille mobile (le rail droit couvre le desktop).
  const moreFromGroup = railData.railMvs.slice(0, 4)

  const dateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(new Date(event.start_at))

  return (
    <>
      {videoId && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'VideoObject', // seul type vidéo éligible aux rich results
            name: title,
            description: `${title} — music video${group?.name ? ` by ${group.name}` : ''}, rated by the KStage community.`,
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            uploadDate: event.start_at,
            embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
            ...(rating.count > 0 && rating.avg !== null
              ? {
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: Number(rating.avg.toFixed(2)),
                    bestRating: 10,
                    ratingCount: rating.count,
                  },
                }
              : {}),
          }}
        />
      )}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-extrabold tracking-[-0.02em] text-balance">
            {title}
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[10px]">
            <Link
              href={`/groups/${group?.slug ?? ''}`}
              className="hover:text-foreground inline-flex items-center gap-1.5 font-medium"
            >
              {group?.image_url ? (
                <Image
                  src={faceCrop(group.image_url, 40, 40)}
                  alt=""
                  width={20}
                  height={20}
                  unoptimized
                  className="size-5 rounded-full object-cover"
                  aria-hidden
                />
              ) : null}
              {group?.name}
            </Link>
            <span aria-hidden>·</span> MV · {dateLabel}
          </p>
        </div>
        <LikeButton
          eventId={event.id}
          slug={slug}
          initialLiked={like.liked}
          count={like.count}
          isAuthed={isAuthed}
        />
      </header>

      {/* Panneau notation : moyenne + étoiles | histogramme, puis slider (§7.7.3). */}
      <Panel>
        <div className="flex items-center justify-between gap-4 p-3.5">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="tabular text-[32px] leading-none font-bold">
                {rating.avg !== null ? rating.avg.toFixed(1) : '—'}
              </span>
              <span className="text-muted-foreground text-xs">/ 10</span>
            </div>
            <p className="tabular text-muted-foreground mt-1 text-[10px]">
              {rating.count} rating{rating.count === 1 ? '' : 's'}
            </p>
          </div>
          <RatingHistogram scores={rating.scores} />
        </div>
        <div className="border-t p-3.5">
          <RatingSlider
            eventId={event.id}
            slug={event.slug as string}
            initialScore={rating.userScore}
            isAuthed={isAuthed}
          />
        </div>
      </Panel>

      {/* lg:hidden : sur desktop le catalogue vit dans le rail droit. */}
      {moreFromGroup.length > 0 && (
        <section className="space-y-2 lg:hidden">
          <div className="flex items-baseline justify-between">
            <span className="label-data">More from {group?.name}</span>
            <Link
              href={`/groups/${group?.slug ?? ''}`}
              className="label-data-inline text-primary hover:text-primary/80 text-[10px] font-semibold transition-colors"
            >
              All MVs →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-[9px] sm:grid-cols-4">
            {moreFromGroup.map((mv) => (
              <MvCard
                key={mv.id}
                mv={mv}
                rating={railData.ratings.get(mv.id)}
                timeZone={timeZone}
              />
            ))}
          </div>
        </section>
      )}

      <CommentSection
        eventId={event.id}
        slug={event.slug as string}
        isAuthed={isAuthed}
        viewerId={viewerId}
        roots={commentRoots}
        initialSort={sort}
        ratingsByUser={rating.scoreByUser}
      />
    </>
  )
}

export default async function MvPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sort?: string }>
}) {
  const { slug } = await params
  // Lot G — invariant soft-404 : le SEUL await bloquant est ce check
  // d'existence (getEventBySlug est mémoïsé, partagé avec generateMetadata).
  // notFound() tombe AVANT tout streaming → un slug bidon répond un vrai 404.
  const event = await loadMv(slug)
  if (!event) notFound()

  const sp = await searchParams
  const sort: SortMode = sp.sort === 'new' ? 'new' : 'top'
  const group = event.groups
  const videoId = extractYouTubeId(event.source_url)
  const title = displaySongTitle(event.title, group?.name)

  return (
    // Rails latéraux (round 2026-07-18) : My groups à gauche (connecté),
    // catalogue du groupe à droite — les deux streamés par PageRails.
    <PageRails
      right={
        group?.slug ? (
          <MvRail groupSlug={group.slug} groupName={group.name} excludeId={event.id} />
        ) : undefined
      }
    >
      <div className="mx-auto w-full max-w-4xl">
        <div className="space-y-3">
          {/* SHELL immédiat : player full-bleed + back — peint dès le premier
              flush, le reste de la page streame dessous (Lot G). */}
          <div className="relative">
            {videoId ? (
              <div className="overflow-hidden md:rounded-lg [&_iframe]:!rounded-none md:[&_iframe]:!rounded-lg">
                <YouTubeEmbed videoId={videoId} title={title} />
              </div>
            ) : (
              <div className="bg-muted text-muted-foreground flex aspect-video w-full items-center justify-center text-sm md:rounded-lg">
                Video unavailable
              </div>
            )}
            <BackButton
              className="absolute top-3 left-3 z-10"
              fallbackHref={group?.slug ? (`/groups/${group.slug}` as Route) : '/'}
            />
          </div>

          <div className="space-y-3 px-3 md:px-0">
            <Suspense fallback={<MvBodySkeleton />}>
              <MvBody event={event} videoId={videoId} title={title} slug={slug} sort={sort} />
            </Suspense>
          </div>
        </div>
      </div>
    </PageRails>
  )
}
