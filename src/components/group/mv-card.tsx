import Image from 'next/image'
import Link from 'next/link'
import { Play, Star } from 'lucide-react'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { displaySongTitle } from '@/lib/events/title'
import { monthYear } from '@/lib/events/date'
import type { MvEvent } from '@/lib/events/queries'

export type Rating = { avg: number; count: number }

/**
 * Card MV Data Desk (§7.1.6) : panneau hairline, thumbnail 16:9 rounded-[7px],
 * play 26px, ligne note (étoile amber + score + count).
 * Le chip « RATE » et la bordure dashed « unrated » ont été retirés
 * (2026-07-12, retour Rudy : vignettes uniformes, pas de CTA qui prend
 * l'utilisateur par la main — la page MV porte déjà la notation).
 */
export function MvCard({
  mv,
  rating,
  timeZone,
}: {
  mv: MvEvent
  rating?: Rating
  timeZone: string
}) {
  const videoId = extractYouTubeId(mv.source_url)
  const thumb = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : mv.image_url
  const group = mv.groups

  return (
    <Link
      href={`/mv/${mv.slug}`}
      draggable={false}
      className="group bg-card focus-visible:ring-primary/40 hover:border-border block rounded-lg border p-[7px] transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
        <p className="line-clamp-2 text-[12px] leading-snug font-semibold">
          {displaySongTitle(mv.title, group?.name)}
        </p>
        {/* Une seule ligne « Groupe · Mois Année » qui PASSE À LA LIGNE au lieu
            de tronquer (R7) : un nom long (DAILY:DIRECTION) garde son nom entier
            ET sa date, jamais coupés. Mois-année sans jour ni apostrophe. */}
        <p className="label-data-inline text-muted-foreground mt-0.5 line-clamp-2 text-[9px]">
          {group?.name} · {monthYear(mv.start_at, timeZone)}
        </p>
        {rating !== undefined && (
          <div className="mt-1.5 flex items-center gap-1">
            <RatingLabel r={rating} />
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
