'use client'

import { useState } from 'react'

/**
 * Embed YouTube léger : thumbnail statique qui ne charge l'iframe qu'au click.
 * Évite le coût initial (~600KB JS) de l'iframe YouTube par défaut.
 */
export function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false)
  const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

  if (playing) {
    return (
      <div className="bg-muted aspect-video w-full overflow-hidden rounded-xl">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          className="h-full w-full"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group bg-muted relative aspect-video w-full overflow-hidden rounded-xl"
      aria-label={`Play ${title}`}
    >
      {/* Thumbnail YouTube : eslint-disable car YT n'est pas dans next.config images.
          C'est l'élément LCP de la page MV (above the fold) — jamais lazy, et
          fetchpriority=high pour que le navigateur le charge en premier
          (Lighthouse : LCP 4-7 s attribué aux posters non priorisés). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumb}
        alt=""
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        fetchPriority="high"
      />
      <span
        className="pointer-events-none absolute inset-0 bg-black/20 transition-colors duration-200 group-hover:bg-black/35"
        aria-hidden
      />
      {/* Bouton play YouTube, et non un rond générique : les YouTube API
          Services Terms (III.F.2.a) demandent de « make clear to the viewer
          that YouTube is the source of the relevant content by displaying
          YouTube Brand Features ». Avant clic, la façade ne montre qu'une
          vignette — rien ne disait d'où venait la vidéo. L'iframe réelle porte
          la marque elle-même une fois chargée ; ici, c'est ce bouton qui
          l'apporte. Forme et couleur officielles, jamais déformées. */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <svg
          viewBox="0 0 68 48"
          className="h-12 w-auto drop-shadow-lg transition-transform duration-200 group-hover:scale-110"
          aria-hidden
        >
          <path
            d="M66.52 7.74a8.03 8.03 0 0 0-5.65-5.7C55.79.99 34 .99 34 .99s-21.79 0-26.87 1.05a8.03 8.03 0 0 0-5.65 5.7A84.1 84.1 0 0 0 .5 24a84.1 84.1 0 0 0 .98 16.26 8.03 8.03 0 0 0 5.65 5.7C12.21 47 34 47 34 47s21.79 0 26.87-1.04a8.03 8.03 0 0 0 5.65-5.7A84.1 84.1 0 0 0 67.5 24a84.1 84.1 0 0 0-.98-16.26Z"
            fill="#FF0000"
          />
          <path d="M27.2 34.4 45.4 24 27.2 13.6v20.8Z" fill="#FFFFFF" />
        </svg>
      </span>
    </button>
  )
}
