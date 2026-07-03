import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEventBySlug, getEventRatingSummary, getLikeSummary } from '@/lib/events/community'
import { getCommentsForEvent } from '@/lib/comments/queries'
import { buildCommentTree, sortTree, type SortMode } from '@/lib/comments/tree'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { displaySongTitle } from '@/lib/events/title'
import { formatKst } from '@/lib/events/date'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/back-button'
import { Panel } from '@/components/ui/panel'
import { YouTubeEmbed } from '@/components/mv/youtube-embed'
import { RatingSlider } from '@/components/mv/rating-slider'
import { RatingHistogram } from '@/components/mv/rating-histogram'
import { LikeButton } from '@/components/mv/like-button'
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
  return {
    title: `${title} — ${group?.name ?? 'KStage'}`,
    description: event.description ?? `${group?.name} music video.`,
  }
}

const droppedAgo = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
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

  const [rating, userRes] = await Promise.all([
    getEventRatingSummary(event.id),
    (async () => {
      const supabase = await createClient()
      return supabase.auth.getUser()
    })(),
  ])
  const viewerId = userRes.data.user?.id ?? null
  const isAuthed = Boolean(userRes.data.user)
  const videoId = extractYouTubeId(event.source_url)
  const like = await getLikeSummary(event.id, viewerId)

  const flatComments = await getCommentsForEvent(event.id, viewerId)
  const commentRoots = sortTree(buildCommentTree(flatComments), sort)

  const title = displaySongTitle(event.title, group?.name)
  const kstLabel = formatKst(event.start_at, { month: 'short', day: 'numeric', year: 'numeric' })
  // Étoiles de moyenne : avg/2 arrondi (affichage compact §7.7.3).
  const filledStars = rating.avg !== null ? Math.round(rating.avg / 2) : 0

  return (
    <div className="mx-auto w-full max-w-3xl md:px-4 md:py-6">
      <div className="space-y-3">
        {/* Player full-bleed sur mobile + back flottant (§7.7.1). */}
        <div className="relative">
          {videoId ? (
            <div className="overflow-hidden md:rounded-[10px] [&_iframe]:!rounded-none md:[&_iframe]:!rounded-[10px]">
              <YouTubeEmbed videoId={videoId} title={title} />
            </div>
          ) : (
            <div className="bg-muted text-muted-foreground flex aspect-video w-full items-center justify-center text-sm md:rounded-[10px]">
              Video unavailable
            </div>
          )}
          <BackButton className="absolute top-3 left-3 z-10" />
        </div>

        <div className="space-y-3 px-3 md:px-0">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-heading text-xl font-extrabold tracking-[-0.02em] text-balance">
                {title}
              </h1>
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                <Link href={`/groups/${group?.slug ?? ''}`} className="hover:text-foreground">
                  {group?.name}
                </Link>{' '}
                · MV · dropped {droppedAgo(event.start_at)} · {kstLabel}
              </p>
            </div>
            <LikeButton
              eventId={event.id}
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
                  <span className="tabular text-[30px] leading-none font-bold">
                    {rating.avg !== null ? rating.avg.toFixed(1) : '—'}
                  </span>
                  <span className="text-muted-foreground text-xs">/ 10</span>
                </div>
                <div className="mt-1.5 flex items-center gap-0.5" aria-hidden>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'size-3.5',
                        i < filledStars ? 'fill-amber text-amber' : 'text-faint fill-transparent',
                      )}
                      strokeWidth={1.5}
                    />
                  ))}
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

          <CommentSection
            eventId={event.id}
            slug={event.slug as string}
            isAuthed={isAuthed}
            viewerId={viewerId}
            roots={commentRoots}
            sort={sort}
            ratingsByUser={rating.scoreByUser}
          />
        </div>
      </div>
    </div>
  )
}
