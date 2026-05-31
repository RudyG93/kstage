import Image from 'next/image'
import Link from 'next/link'
import { PlayCircle, Star } from 'lucide-react'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { displayEventTitle } from '@/lib/events/title'
import { cn } from '@/lib/utils'
import type { MvEvent } from '@/lib/events/queries'

const yearMonth = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'short',
  }).format(new Date(iso))

export type Rating = { avg: number; count: number }

/** Card MV cliquable vers /mv/[slug] (thumbnail YouTube + titre + meta + note). */
export function MvCard({ mv, rating }: { mv: MvEvent; rating?: Rating }) {
  const videoId = extractYouTubeId(mv.source_url)
  const thumb = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : mv.image_url
  const group = mv.groups
  return (
    <Link
      href={`/mv/${mv.slug}`}
      className="group focus-visible:ring-primary/40 block rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-xl">
        {thumb ? (
          <Image
            src={thumb}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
        <span
          className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/30"
          aria-hidden
        />
        <PlayCircle
          className="pointer-events-none absolute inset-0 m-auto size-10 text-white opacity-0 drop-shadow-lg transition-opacity duration-200 group-hover:opacity-100"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="line-clamp-2 text-sm leading-snug font-medium">
          {displayEventTitle(mv.title, group?.name)}
        </p>
        <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] tracking-wider uppercase">
          <span>{group?.name}</span>
          <span aria-hidden>·</span>
          <span>{yearMonth(mv.start_at)}</span>
          {rating !== undefined && (
            <>
              <span aria-hidden>·</span>
              <RatingLabel r={rating} />
            </>
          )}
        </p>
      </div>
    </Link>
  )
}

function RatingLabel({ r }: { r?: Rating }) {
  const hasVotes = r && r.count > 0
  return (
    <span className="inline-flex items-center gap-0.5">
      <Star
        className={cn(
          'size-3',
          hasVotes
            ? 'fill-yellow-400 text-yellow-400'
            : 'text-muted-foreground/60 fill-transparent',
        )}
        strokeWidth={1.5}
        aria-hidden
      />
      <span
        aria-label={
          hasVotes
            ? `Average ${r.avg.toFixed(1)} out of 10 from ${r.count} votes`
            : 'No ratings yet'
        }
      >
        {hasVotes ? `${r.avg.toFixed(1)} (${r.count})` : '—'}
      </span>
    </span>
  )
}
