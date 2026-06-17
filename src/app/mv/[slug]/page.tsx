import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getEventBySlug, getEventRatingSummary, getLikeSummary } from '@/lib/events/community'
import { getCommentsForEvent } from '@/lib/comments/queries'
import { buildCommentTree, sortTree, type SortMode } from '@/lib/comments/tree'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { displaySongTitle } from '@/lib/events/title'
import { formatKst } from '@/lib/events/date'
import { faceCrop } from '@/lib/images/cloudinary'
import { LocalTime } from '@/components/local-time'
import { YouTubeEmbed } from '@/components/mv/youtube-embed'
import { RatingSlider } from '@/components/mv/rating-slider'
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
  const color = group?.color_hex ?? '#7c5cff'
  const title = displaySongTitle(event.title, group?.name)

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

  const dateLabel = formatKst(event.start_at, {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
  const timeLabel = formatKst(event.start_at, { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="space-y-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/groups/${group?.slug ?? ''}`}
              className="hover:text-foreground text-muted-foreground inline-flex items-center gap-2"
            >
              {group?.image_url ? (
                <Image
                  src={faceCrop(group.image_url, 56, 56)}
                  alt=""
                  width={20}
                  height={20}
                  unoptimized
                  className="size-5 rounded-full object-cover"
                />
              ) : (
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
              )}
              {group?.name}
            </Link>
            <span className="text-muted-foreground">·</span>
            <span
              className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider uppercase"
              style={{ color, backgroundColor: `${color}24` }}
            >
              MV
            </span>
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">{title}</h1>
          <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
            {dateLabel} · <LocalTime iso={event.start_at} withZone={false} fallback={timeLabel} /> ·{' '}
            {timeLabel} KST
          </p>
        </header>

        {videoId ? (
          <YouTubeEmbed videoId={videoId} title={title} />
        ) : (
          <div className="bg-muted text-muted-foreground flex aspect-video w-full items-center justify-center rounded-xl text-sm">
            Video unavailable
          </div>
        )}

        <section aria-labelledby="like-heading" className="space-y-2">
          <h2 id="like-heading" className="text-sm font-medium">
            Like
          </h2>
          <LikeButton
            eventId={event.id}
            initialLiked={like.liked}
            count={like.count}
            isAuthed={isAuthed}
          />
        </section>

        <section aria-labelledby="rating-heading" className="space-y-2">
          <h2 id="rating-heading" className="text-sm font-medium">
            Your rating
          </h2>
          <RatingSlider
            eventId={event.id}
            slug={event.slug as string}
            initialScore={rating.userScore}
            avgScore={rating.avg}
            count={rating.count}
            isAuthed={isAuthed}
          />
        </section>

        <CommentSection
          eventId={event.id}
          slug={event.slug as string}
          isAuthed={isAuthed}
          viewerId={viewerId}
          roots={commentRoots}
          sort={sort}
        />
      </div>
    </div>
  )
}
