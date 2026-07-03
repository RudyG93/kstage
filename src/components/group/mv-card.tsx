import Image from 'next/image'
import Link from 'next/link'
import { Play, Star } from 'lucide-react'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { displaySongTitle } from '@/lib/events/title'
import { cn } from '@/lib/utils'
import type { MvEvent } from '@/lib/events/queries'

const yearMonth = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'short',
  }).format(new Date(iso))

export type Rating = { avg: number; count: number }

/**
 * Card MV Data Desk (§7.1.6) : panneau hairline, thumbnail 16:9 rounded-[7px],
 * play 26px, ligne note (étoile amber + score + count) + chip RATE.
 * 0 note → bordure dashed primary + « Be the first to rate » (état actionnable).
 */
export function MvCard({
  mv,
  rating,
  showRateChip = false,
}: {
  mv: MvEvent
  rating?: Rating
  // Chip RATE à droite de la ligne note (grilles FRESH/LATEST DROPS).
  showRateChip?: boolean
}) {
  const videoId = extractYouTubeId(mv.source_url)
  const thumb = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : mv.image_url
  const group = mv.groups
  const unrated = rating !== undefined && rating.count === 0

  return (
    <Link
      href={`/mv/${mv.slug}`}
      draggable={false}
      className={cn(
        'group bg-card focus-visible:ring-primary/40 block rounded-[10px] border p-[7px] transition-colors focus-visible:ring-2 focus-visible:outline-none',
        showRateChip && unrated ? 'border-primary/45 border-dashed' : 'hover:border-border',
      )}
    >
      <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-[7px]">
        {thumb ? (
          <Image
            src={thumb}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span
            className="absolute inset-0"
            style={
              group?.color_hex
                ? {
                    background: `linear-gradient(135deg, ${group.color_hex}66, ${group.color_hex}1f)`,
                  }
                : undefined
            }
            aria-hidden
          />
        )}
        <span
          className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/25"
          aria-hidden
        />
        <Play
          className="pointer-events-none absolute inset-0 m-auto size-[26px] fill-white text-white opacity-80 drop-shadow-lg transition-opacity duration-200 group-hover:opacity-100"
          strokeWidth={1}
          aria-hidden
        />
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="line-clamp-2 text-[11.5px] leading-snug font-semibold">
          {displaySongTitle(mv.title, group?.name)}
        </p>
        <p className="label-data-inline text-muted-foreground mt-0.5 truncate text-[9px]">
          {group?.name} · {yearMonth(mv.start_at)}
        </p>
        {rating !== undefined && (
          <div className="mt-1.5 flex items-center gap-1">
            <RatingLabel r={rating} />
            {showRateChip && (
              <span
                className={cn(
                  'label-data-inline ml-auto rounded-[6px] px-2 py-1 text-[8.5px]',
                  unrated
                    ? 'bg-primary text-primary-foreground'
                    : 'border-primary/50 text-primary border',
                )}
              >
                Rate
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

function RatingLabel({ r }: { r?: Rating }) {
  const hasVotes = r && r.count > 0
  if (!hasVotes) {
    return <span className="text-muted-foreground text-[10px]">Be the first to rate</span>
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Star className="fill-amber text-amber size-3.5" strokeWidth={1.5} aria-hidden />
      <span
        className="tabular text-xs font-semibold"
        aria-label={`Average ${r.avg.toFixed(1)} out of 10 from ${r.count} votes`}
      >
        {r.avg.toFixed(1)}
      </span>
      <span className="text-muted-foreground text-[10px]">· {r.count}</span>
    </span>
  )
}
