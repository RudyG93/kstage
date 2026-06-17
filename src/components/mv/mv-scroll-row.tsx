'use client'

import { useRef, type PointerEvent, type MouseEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight } from 'lucide-react'
import { MvCard } from '@/components/group/mv-card'
import type { RatingMap } from '@/components/group/mvs-grid'
import type { MvEvent } from '@/lib/events/queries'

// Ligne horizontale de MV avec drag-to-scroll à la souris (le tactile garde le
// scroll natif). Bandeau d'en-tête par groupe (§3.2) si `image` fourni.
export function MvScrollRow({
  title,
  href,
  mvs,
  ratings,
  image,
  color,
}: {
  title: string
  href: string
  mvs: MvEvent[]
  ratings?: RatingMap
  image?: string | null
  color?: string | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false })

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return // tactile = scroll natif
    const el = ref.current
    if (!el) return
    // PAS de e.preventDefault() (supprimerait le `click`) et PAS de
    // setPointerCapture : la capture redirige le `click` vers le conteneur au lieu
    // du <Link> → un simple clic n'ouvrait plus le MV. Le drag-scroll se fait via
    // pointermove (la ligne est large, le curseur reste dessus) ; le ghost-drag
    // natif est tué par `onDragStart` + `draggable={false}` sur les cards.
    drag.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false }
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el || !drag.current.active) return
    const dx = e.clientX - drag.current.startX
    if (Math.abs(dx) > 4) drag.current.moved = true
    el.scrollLeft = drag.current.startScroll - dx
  }
  function onPointerUp() {
    drag.current.active = false
  }
  function onClickCapture(e: MouseEvent<HTMLDivElement>) {
    // Empêche la navigation de la card si on vient de drag.
    if (drag.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      drag.current.moved = false
    }
  }

  return (
    <section className="space-y-2">
      {image ? (
        <div className="relative h-16 overflow-hidden rounded-xl">
          <Image src={image} alt="" fill unoptimized sizes="900px" className="object-cover" />
          <span
            className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25"
            aria-hidden
          />
          {color && (
            <span
              className="absolute inset-y-0 left-0 w-1"
              style={{ backgroundColor: color }}
              aria-hidden
            />
          )}
          <div className="absolute inset-0 flex items-center justify-between gap-3 px-4">
            <h3 className="truncate text-lg font-bold text-white drop-shadow-sm">{title}</h3>
            <Link
              href={href}
              className="inline-flex shrink-0 items-center text-xs text-white/80 hover:text-white"
            >
              See more
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">{title}</h3>
          <Link
            href={href}
            className="text-muted-foreground hover:text-foreground inline-flex items-center text-xs"
          >
            See more
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
        className="flex cursor-grab scrollbar-thin gap-3 overflow-x-auto pb-2 select-none active:cursor-grabbing"
      >
        {mvs.map((mv) => (
          <div key={mv.id} className="w-44 shrink-0">
            <MvCard mv={mv} rating={ratings?.get(mv.id)} />
          </div>
        ))}
      </div>
    </section>
  )
}
