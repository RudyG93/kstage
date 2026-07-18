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
import { YouTubeEmbed } from '@/components/mv/youtube-embed'
import { RatingSlider } from '@/components/mv/rating-slider'
import { RatingHistogram } from '@/components/mv/rating-histogram'
import { LikeButton } from '@/components/mv/like-button'
import { MvCard } from '@/components/group/mv-card'
import { MvRightRail } from '@/components/mv/mv-right-rail'
import { PageRails } from '@/components/layout/page-rails'
import { CommentSection } from '@/components/mv/comments/comment-section'

async function loadMv(slug: string) {
  const event = await getEventBySlug(slug)
  if (!event || event.type !== 'mv' || !event.slug) return null
  return event
}

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

export default async function MvPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sort?: string }>
}) {
  const { slug } = await params
  const event = await loadMv(slug)
  if (!event) notFound()

  const sp = await searchParams
  const sort: SortMode = sp.sort === 'new' ? 'new' : 'top'

  const group = event.groups

  // Vagues réduites 5 → 3 (Lot A perf 2026-07-18) : getViewer (mémoïsé, déjà
  // payé par le layout) fournit viewerId, puis TOUT le contenu part en un seul
  // Promise.all — getLikeSummary vivait seul dans sa propre vague.
  const { user: viewer } = await getViewer()
  const viewerId = viewer?.id ?? null
  const isAuthed = viewer != null
  const videoId = extractYouTubeId(event.source_url)

  const [rating, like, flatComments, groupMvs, timeZone] = await Promise.all([
    getEventRatingSummary(event.id),
    getLikeSummary(event.id, viewerId),
    getCommentsForEvent(event.id, viewerId),
    group?.slug ? getGroupMvs(group.slug, 9) : Promise.resolve([]),
    getViewerTimeZone(),
  ])
  const commentRoots = sortTree(buildCommentTree(flatComments), sort)
  // « More from {group} » : le reste du catalogue, sans le MV courant.
  // In-column mobile : 4 ; rail droit desktop (round 2026-07-18) : jusqu'à 9.
  const railMvs = groupMvs.filter((m) => m.id !== event.id)
  const moreFromGroup = railMvs.slice(0, 4)
  const moreRatings = await getRatingsForEvents(railMvs.map((m) => m.id))

  const title = displaySongTitle(event.title, group?.name)
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(new Date(event.start_at))
  // Étoiles de moyenne : avg/2 arrondi (affichage compact §7.7.3).

  return (
    // Rails latéraux (round 2026-07-18 — « utilisons tout l'espace ») : My
    // groups à gauche (connecté), catalogue du groupe à droite ; le contenu
    // central garde sa largeur de lecture.
    <PageRails
      signedIn={isAuthed}
      right={
        railMvs.length > 0 && group?.slug ? (
          <MvRightRail
            groupName={group.name}
            groupSlug={group.slug}
            mvs={railMvs.slice(0, 9)}
            ratings={moreRatings}
            timeZone={timeZone}
          />
        ) : undefined
      }
    >
      <div className="mx-auto w-full max-w-4xl">
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
        <div className="space-y-3">
          {/* Player full-bleed sur mobile + back flottant (§7.7.1). */}
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
                      rating={moreRatings.get(mv.id)}
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
          </div>
        </div>
      </div>
    </PageRails>
  )
}
