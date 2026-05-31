import type { ReactNode } from 'react'
import Image from 'next/image'

// Bandeau partagé page groupe / page artiste solo : image cover + scrim + nom,
// avec un slot optionnel (bouton follow) en haut à droite.
export function ArtistHero({
  name,
  image,
  follow,
}: {
  name: string
  image: string | null
  follow?: ReactNode
}) {
  return (
    <div className="relative h-44 overflow-hidden rounded-2xl sm:h-52">
      {image ? (
        <Image
          src={image}
          alt=""
          aria-hidden
          fill
          unoptimized
          sizes="(min-width: 768px) 672px, 100vw"
          className="object-cover object-center"
        />
      ) : (
        <div className="gradient-signature absolute inset-0" aria-hidden />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10"
        aria-hidden
      />
      {follow && <div className="absolute top-3 right-3">{follow}</div>}
      <h1 className="absolute inset-x-0 bottom-0 truncate p-4 text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
        {name}
      </h1>
    </div>
  )
}
