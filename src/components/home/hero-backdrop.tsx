'use client'

import { useState } from 'react'
import Image from 'next/image'

/**
 * Fond photo du hero NEXT UP. Client pour le repli d'erreur : la miniature
 * maxres d'un MV n'existe pas pour toutes les vidéos (404) → on retombe sur
 * hqdefault (toujours servie), puis sur rien (le gradient de marque reste).
 */
export function HeroBackdrop({ src, fallbackSrc }: { src: string; fallbackSrc?: string | null }) {
  const [current, setCurrent] = useState(src)
  const [dead, setDead] = useState(false)
  if (dead) return null

  return (
    <Image
      src={current}
      alt=""
      fill
      // Optimisé (host i.ytimg.com whitelisté) : Next sert un webp redimensionné
      // au `sizes` plutôt que le maxresdefault 1280×720 plein — gros gain mobile
      // sur l'élément LCP de la home, d'où `priority`.
      priority
      quality={70}
      sizes="(min-width: 1024px) 640px, 100vw"
      className="object-cover object-[70%_30%]"
      onError={() => {
        if (fallbackSrc && current !== fallbackSrc) setCurrent(fallbackSrc)
        else setDead(true)
      }}
      aria-hidden
    />
  )
}
