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
 * DEUX destinations, et c'est volontaire (2026-08-23) : la vignette mène à la
 * scène du diffuseur, le pied de carte mène à la PAGE ÉPISODE.
 *
 * Avant, une carte avec vidéo n'avait qu'une sortie externe : les 64 pages
 * épisode n'étaient atteignables que par le calendrier, à la bonne date, et
 * 658 passages ne se reliaient à rien en interne. Deux liens frères plutôt
 * qu'imbriqués (un <a> dans un <a> est invalide, et le clic devient un pari).
 *
 * Sans vidéo, la vignette elle-même pointe l'épisode et affiche « Video soon »
 * au lieu d'un bouton play : le passage a eu lieu, la scène arrivera.
 */
// Le jour affiche est le jour KST, pas celui du viewer : cette vignette nomme
// un EPISODE, et l'identite d'un episode est sa date de diffusion coreenne —
// c'est elle qui est dans l'URL (episodeHref → kstDayKey) et sur la page
// d'episode (formatKst). Le libelle et sa destination se contredisaient d'un
// jour pour tout viewer a l'ouest de Seoul.
export function StageCard({ stage }: { stage: GroupStage }) {
  const videoId = extractYouTubeId(stage.stage_url)
  // `image_url` porte la miniature `default.jpg` (120 px) renvoyée par l'API :
  // on remonte en hqdefault quand l'id est lisible.
  const thumb = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : stage.image_url
  const icon = SHOW_ICON_BY_TITLE[stage.title]
  // Null pour un show hors descripteur : la page épisode n'existe pas, on ne
  // renvoie pas vers un 404.
  const episode = episodeHref(stage)
  const title = `${stage.title}${stage.episode_number ? ` #${stage.episode_number}` : ''}`

  const visual = (
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
        <>
          <Play
            className="pointer-events-none absolute inset-0 m-auto size-[26px] fill-white text-white opacity-80 drop-shadow-lg transition-opacity duration-200 group-hover:opacity-100"
            strokeWidth={1}
            aria-hidden
          />
          {/* Pastille de convention (BACKLOG 2026-06-16) : elle vit sur le
              VISUEL, seul élément de la carte qui sorte du site depuis que le
              pied mène à la page épisode. */}
          <ExternalLink
            className="pointer-events-none absolute top-1 right-1 size-3 text-white/80 drop-shadow"
            aria-hidden
          />
          <span className="sr-only">opens an external site</span>
        </>
      ) : (
        // Sans vidéo : dire l'attente plutôt que promettre une lecture.
        <span className="label-data-inline text-muted-foreground pointer-events-none absolute inset-0 m-auto flex items-center justify-center text-[9px]">
          Video soon
        </span>
      )}
    </div>
  )

  const meta = (
    <>
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
        <span className="block truncate text-[12px] leading-snug font-semibold">{title}</span>
        <span className="label-data-inline text-muted-foreground mt-0.5 block text-[9px]">
          {dayMonthYear(stage.start_at, 'Asia/Seoul')}
        </span>
      </span>
    </>
  )

  return (
    <div className="group bg-card hover:border-border rounded-lg border p-[7px] transition-colors">
      {stage.stage_url ? (
        <a
          href={stage.stage_url}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          aria-label={`${title} — watch the stage`}
          className="focus-visible:ring-primary/40 block rounded-[7px] focus-visible:ring-2 focus-visible:outline-none"
        >
          {visual}
        </a>
      ) : episode ? (
        <Link
          href={episode as Route}
          draggable={false}
          aria-label={`${title} — episode page`}
          className="focus-visible:ring-primary/40 block rounded-[7px] focus-visible:ring-2 focus-visible:outline-none"
        >
          {visual}
        </Link>
      ) : (
        visual
      )}

      {episode ? (
        <Link
          href={episode as Route}
          draggable={false}
          className="hover:bg-hover focus-visible:ring-primary/40 mt-1.5 flex items-start gap-1.5 rounded-[5px] px-0.5 py-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {meta}
        </Link>
      ) : (
        <div className="mt-1.5 flex items-start gap-1.5 px-0.5 py-0.5">{meta}</div>
      )}
    </div>
  )
}
