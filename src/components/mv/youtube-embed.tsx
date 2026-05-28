'use client'

import { useState } from 'react'
import { PlayCircle } from 'lucide-react'

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
      {/* Thumbnail YouTube : eslint-disable car YT n'est pas dans next.config images */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumb}
        alt=""
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      <span
        className="pointer-events-none absolute inset-0 bg-black/20 transition-colors duration-200 group-hover:bg-black/35"
        aria-hidden
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <PlayCircle
          className="size-16 text-white drop-shadow-lg transition-transform duration-200 group-hover:scale-110"
          strokeWidth={1.5}
        />
      </span>
    </button>
  )
}
