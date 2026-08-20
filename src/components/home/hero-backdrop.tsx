'use client'

import { useState } from 'react'
import Image from 'next/image'

/**
 * Fond photo du hero NEXT UP. Client pour le repli d'erreur : la miniature
 * maxres d'un MV n'existe pas pour toutes les vidéos (18/90 = 404 mesuré,
 * audit 2026-08-20) → on retombe sur hqdefault (90/90 = 200), puis sur rien
 * (le gradient de marque reste).
 */
export function HeroBackdrop({ src, fallbackSrc }: { src: string; fallbackSrc?: string | null }) {
  const [current, setCurrent] = useState(src)
  const [dead, setDead] = useState(false)

  const fail = () => {
    if (fallbackSrc && current !== fallbackSrc) setCurrent(fallbackSrc)
    else setDead(true)
  }

  // Course d'hydratation (audit 2026-08-20) : image `priority` = chargée dès
  // le HTML SSR, un 404 peut survenir AVANT l'hydratation — onError React ne
  // rejoue jamais et le hero restait vide. Le callback ref détecte l'échec a
  // posteriori dès l'attache du nœud : complete + naturalWidth === 0 est le
  // signal fiable d'une image déjà en erreur (MDN HTMLImageElement.complete).
  const detectPreHydrationError = (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) fail()
  }

  if (dead) return null

  return (
    <Image
      ref={detectPreHydrationError}
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
      onError={fail}
      aria-hidden
    />
  )
}
