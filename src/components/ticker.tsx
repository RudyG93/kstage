'use client'

import { useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TickerItem } from '@/lib/events/ticker'

// Bande live 30px (§7.1.2) — marquee CSS pur : contenu répété jusqu'à couvrir
// large (pas de trou au reset de boucle), pause au hover, statique si
// prefers-reduced-motion ou trop peu d'items. Dots = couleur du type d'event,
// pulse --live pour les events du jour.
//
// Client component depuis 2026-07-11 : WCAG 2.2.2 (niveau A) exige un contrôle
// pause/stop pour tout contenu en mouvement > 5 s — le hover-pause n'existe
// pas au tactile (la cible est mobile-first) ni au clavier.
export function Ticker({ items }: { items: TickerItem[] }) {
  const [paused, setPaused] = useState(false)
  if (items.length === 0) return null

  // La boucle translateX(0→−50%) n'est propre que si une copie couvre au moins
  // la largeur du viewport : on répète la liste de base jusqu'à ≥ 8 entrées.
  // Avec < 3 items uniques, une bande défilante serait répétitive → statique.
  const animate = items.length >= 3
  const base: TickerItem[] = []
  while (base.length < 8) base.push(...items)

  const row = (ariaHidden: boolean) => (
    <div
      className="flex shrink-0 items-center gap-7 pr-7"
      {...(ariaHidden ? { 'aria-hidden': true } : {})}
    >
      {(ariaHidden || animate ? base : items).map((item, i) => (
        <span key={i} className="flex items-center gap-2 whitespace-nowrap">
          <span
            className={cn(
              'size-[5px] shrink-0 rounded-full',
              item.live ? 'bg-live animate-live-pulse' : 'animate-upcoming-pulse',
            )}
            style={item.live ? undefined : { backgroundColor: item.color }}
            aria-hidden
          />
          <span className="label-data text-foreground/80">{item.text}</span>
        </span>
      ))}
    </div>
  )

  return (
    <div className="bg-page flex h-[30px] items-center overflow-hidden border-y">
      {animate && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          aria-label={paused ? 'Resume live ticker' : 'Pause live ticker'}
          className="text-faint hover:text-foreground focus-visible:ring-ring flex h-full w-8 shrink-0 items-center justify-center border-r focus-visible:ring-2 focus-visible:outline-none"
        >
          {paused ? (
            <Play className="size-3" aria-hidden />
          ) : (
            <Pause className="size-3" aria-hidden />
          )}
        </button>
      )}
      <div
        className={cn('flex w-max', animate && 'animate-marquee')}
        style={animate && paused ? { animationPlayState: 'paused' } : undefined}
      >
        {row(false)}
        {animate && row(true)}
      </div>
    </div>
  )
}
