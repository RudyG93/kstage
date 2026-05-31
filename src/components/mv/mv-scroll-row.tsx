'use client'

import { useRef, type PointerEvent, type MouseEvent } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { MvCard } from '@/components/group/mv-card'
import type { RatingMap } from '@/components/group/mvs-grid'
import type { MvEvent } from '@/lib/events/queries'

// Ligne horizontale de MV avec drag-to-scroll à la souris (le tactile garde le
// scroll natif). « See more » à droite → page du groupe.
export function MvScrollRow({
  title,
  href,
  mvs,
  ratings,
}: {
  title: string
  href: string
  mvs: MvEvent[]
  ratings?: RatingMap
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false })

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return // tactile = scroll natif
    const el = ref.current
    if (!el) return
    drag.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false }
    el.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el || !drag.current.active) return
    const dx = e.clientX - drag.current.startX
    if (Math.abs(dx) > 4) drag.current.moved = true
    el.scrollLeft = drag.current.startScroll - dx
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    drag.current.active = false
    ref.current?.releasePointerCapture?.(e.pointerId)
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
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClickCapture={onClickCapture}
        className="flex cursor-grab gap-3 overflow-x-auto pb-2 active:cursor-grabbing"
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
