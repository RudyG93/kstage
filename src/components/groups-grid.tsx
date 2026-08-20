'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { Route } from 'next'
import { GroupCard, type GroupCardData, type NextEventInfo } from '@/components/group-card'

export type GroupGridItem = {
  group: GroupCardData
  href?: Route
  nextEvent?: NextEventInfo | null
}

/** Lot initial rendu (SSR + premier paint) ; la suite arrive au scroll. */
const INITIAL_WINDOW = 48
const WINDOW_STEP = 96

/**
 * Grille de groupes avec recherche live (§5.1). La liste (déjà triée) est rendue
 * côté serveur puis filtrée côté client par nom — filtrage instantané à la frappe
 * via useDeferredValue pour garder la saisie fluide.
 *
 * Fenêtre de rendu (audit perf 2026-08-20) : /groups pesait 550 Ko de HTML
 * (~5 000 nœuds, Lighthouse alerte dès ~1 400) parce que les ~172 tuiles des
 * DEUX onglets partaient dans le HTML initial. Seul un premier lot est rendu ;
 * un sentinel IntersectionObserver déplie la suite en approchant du bas. La
 * recherche filtre toujours la liste COMPLÈTE (les données restent côté client).
 */
export function GroupsGrid({
  items,
  timeZone,
  followedIds,
  isAuthed,
  priorityCount = 0,
}: {
  items: GroupGridItem[]
  timeZone: string
  followedIds: ReadonlySet<string>
  isAuthed: boolean
  /** N premières tuiles au-dessus de la fold → images priority (LCP). */
  priorityCount?: number
}) {
  const [q, setQ] = useState('')
  const deferredQ = useDeferredValue(q)
  const [visible, setVisible] = useState(INITIAL_WINDOW)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const filtered = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase()
    if (!needle) return items
    return items.filter((it) => it.group.name.toLowerCase().includes(needle))
  }, [items, deferredQ])

  // En recherche active la liste filtrée est courte → pas de fenêtre.
  const windowed = deferredQ.trim() ? filtered : filtered.slice(0, visible)
  const hasMore = windowed.length < filtered.length

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible((v) => v + WINDOW_STEP)
      },
      { rootMargin: '600px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search groups…"
          aria-label="Search groups"
          className="border-input bg-background focus-visible:ring-ring/50 h-10 w-full rounded-lg border pr-3 pl-9 text-sm outline-none focus-visible:ring-2"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">No group matches “{q}”.</p>
      ) : (
        <div className="grid grid-cols-2 gap-[9px] md:grid-cols-3">
          {windowed.map((it, i) => (
            // Sous la fold (~12 tuiles visibles) : content-visibility saute le
            // rendu hors-écran des tuiles images — petites configs (round
            // 2026-07-18). contain-intrinsic-size réserve la hauteur (pas de
            // saut de scrollbar).
            <div
              key={it.group.slug}
              className={
                i >= 12
                  ? '[contain-intrinsic-size:auto_280px] [content-visibility:auto]'
                  : undefined
              }
            >
              <GroupCard
                group={it.group}
                isFollowing={followedIds.has(it.group.id)}
                isAuthed={isAuthed}
                timeZone={timeZone}
                href={it.href}
                nextEvent={it.nextEvent}
                priority={i < priorityCount}
              />
            </div>
          ))}
        </div>
      )}
      {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden />}
    </div>
  )
}
