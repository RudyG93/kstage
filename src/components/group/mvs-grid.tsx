import Image from 'next/image'
import Link from 'next/link'
import { PlayCircle } from 'lucide-react'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { displayEventTitle } from '@/lib/events/title'
import type { MvEvent } from '@/lib/events/queries'

const yearMonth = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'short',
  }).format(new Date(iso))

/**
 * Grille responsive de MVs cliquables vers /mv/[slug]. Réutilise hqdefault
 * (480×360) depuis i.ytimg.com plutôt que le thumbnail par défaut 90×120 que
 * le scraper stocke en `image_url` — l'extraction du videoId depuis source_url
 * est gratuite (helper existant).
 */
export function MvsGrid({ mvs }: { mvs: MvEvent[] }) {
  if (mvs.length === 0) return null
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {mvs.map((mv) => {
        const videoId = extractYouTubeId(mv.source_url)
        const thumb = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : mv.image_url
        const group = mv.groups
        return (
          <li key={mv.id}>
            <Link
              href={`/mv/${mv.slug}`}
              className="group focus-visible:ring-primary/40 block overflow-hidden rounded-xl focus-visible:ring-2 focus-visible:outline-none"
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
                <p className="text-muted-foreground mt-0.5 font-mono text-[11px] tracking-wider uppercase">
                  {group?.name} · {yearMonth(mv.start_at)}
                </p>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
