import Image from 'next/image'
import Link from 'next/link'
import type { Route } from 'next'
import { ExternalLink, Play } from 'lucide-react'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { episodeHref } from '@/lib/events/href'
import { dayMonthYear } from '@/lib/events/date'
import { SHOW_ICON_BY_TITLE } from '@/lib/scrapers/music-shows/types'
import type { GroupStage } from '@/lib/events/queries'

/**
 * Vignette « passage en music show » — même langage visuel que MvCard
 * (panneau hairline, thumbnail 16:9, play 26px).
 *
 * Ces passages n'avaient aucune surface sur la page d'un artiste : la section
 * events ne montre que le À VENIR, donc une scène diffusée n'était atteignable
 * que par le calendrier, à la bonne date.
 *
 * Deux destinations selon l'état de la ligne (2026-08-22) :
 * - vidéo publiée → lien EXTERNE vers la scène du diffuseur, pastille
 *   ExternalLink de convention (BACKLOG 2026-06-16) ;
 * - pas encore de vidéo → lien INTERNE vers la page épisode, qui porte le
 *   lineup et récupérera la scène dès qu'elle sortira. Avant, la carte était
 *   simplement absente de la page : c'est ce qui faisait qu'un groupe crédité
 *   de 13 passages dans le rail n'en montrait que 11 chez lui.
 */
export function StageCard({ stage, timeZone }: { stage: GroupStage; timeZone: string }) {
  const videoId = extractYouTubeId(stage.stage_url)
  // `image_url` porte la miniature `default.jpg` (120 px) renvoyée par l'API :
  // on remonte en hqdefault quand l'id est lisible.
  const thumb = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : stage.image_url
  const icon = SHOW_ICON_BY_TITLE[stage.title]
  // Un show hors descripteur (pas de page épisode) et sans vidéo n'a aucune
  // destination honnête : la carte reste alors muette plutôt que de renvoyer
  // vers un 404 ou vers `#`.
  const episode = stage.stage_url ? null : episodeHref(stage)
  const href = stage.stage_url ?? episode

  const className =
    'group bg-card focus-visible:ring-primary/40 hover:border-border block rounded-lg border p-[7px] transition-colors focus-visible:ring-2 focus-visible:outline-none'

  const body = (
    <>
      <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-[7px]">
        {thumb && (
          <Image
            src={thumb}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <span
          className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/25"
          aria-hidden
        />
        {stage.stage_url ? (
          <Play
            className="pointer-events-none absolute inset-0 m-auto size-[26px] fill-white text-white opacity-80 drop-shadow-lg transition-opacity duration-200 group-hover:opacity-100"
            strokeWidth={1}
            aria-hidden
          />
        ) : (
          // Sans vidéo : dire l'attente plutôt que promettre une lecture.
          <span className="label-data-inline text-muted-foreground pointer-events-none absolute inset-0 m-auto flex items-center justify-center text-[9px]">
            Video soon
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-start gap-1.5 px-0.5">
        {icon && (
          <Image
            src={icon}
            alt=""
            width={16}
            height={16}
            unoptimized
            className="mt-[1px] size-4 shrink-0 rounded-[3px] object-cover"
            aria-hidden
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] leading-snug font-semibold">
            {stage.title}
            {stage.episode_number ? ` #${stage.episode_number}` : ''}
          </span>
          <span className="label-data-inline text-muted-foreground mt-0.5 block text-[9px]">
            {dayMonthYear(stage.start_at, timeZone)}
          </span>
        </span>
        {stage.stage_url && (
          <>
            <ExternalLink className="text-muted-foreground mt-[1px] size-3 shrink-0" aria-hidden />
            <span className="sr-only">opens an external site</span>
          </>
        )}
      </div>
    </>
  )

  if (!href) return <div className={className}>{body}</div>

  if (episode) {
    return (
      <Link href={episode as Route} draggable={false} className={className}>
        {body}
      </Link>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      draggable={false}
      className={className}
    >
      {body}
    </a>
  )
}
