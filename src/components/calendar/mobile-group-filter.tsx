'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useCalendarFilters } from '@/components/calendar/calendar-filters'
import { cn } from '@/lib/utils'

/**
 * Filtres de groupes AVANT la grille en mobile (audit §8.5 : la sidebar
 * Filters arrive après tout le calendrier dans l'ordre mobile). `lg:hidden` —
 * en desktop la sidebar reste la seule surface (le doublon de scope avait été
 * retiré sur retour Rudy 2026-07-12 ; ici il n'existe pas : la sidebar est
 * sous la grille à ce breakpoint). Branché sur le MÊME CalendarFilterProvider
 * → zéro refetch, persistance localStorage identique.
 */
export function MobileGroupFilter({ children }: { children: ReactNode }) {
  const { selectedSlugs, reset, selectMyGroups, followedSlugs } = useCalendarFilters()
  const [open, setOpen] = useState(false)

  const myGroupsActive =
    followedSlugs.length > 0 &&
    selectedSlugs.size === followedSlugs.length &&
    followedSlugs.every((s) => selectedSlugs.has(s))
  const allActive = selectedSlugs.size === 0

  const chip = (active: boolean) =>
    cn(
      'label-data-inline cursor-pointer rounded-sm px-2.5 py-1.5 text-[9px] transition-colors',
      active
        ? 'bg-foreground text-background'
        : 'bg-secondary text-muted-foreground hover:text-foreground',
    )

  return (
    <div className="space-y-2 lg:hidden">
      <div className="flex items-center gap-1.5">
        {followedSlugs.length > 0 && (
          <button
            type="button"
            onClick={selectMyGroups}
            aria-pressed={myGroupsActive}
            className={chip(myGroupsActive)}
          >
            My groups
          </button>
        )}
        <button type="button" onClick={reset} aria-pressed={allActive} className={chip(allActive)}>
          All
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="label-data-inline text-muted-foreground hover:text-foreground ml-auto flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1.5 text-[9px]"
        >
          Filter groups{selectedSlugs.size > 0 ? ` (${selectedSlugs.size})` : ''}
          <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      {open && <div className="bg-card rounded-lg border p-3">{children}</div>}
    </div>
  )
}
