'use client'

import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  FILTERABLE_EVENT_TYPES,
  eventTypeTint,
} from '@/lib/events/labels'
import { useCalendarFilters } from '@/components/calendar/calendar-filters'
import { cn } from '@/lib/utils'

// Chips de filtres Calendar (§7.2) : rangée types (ALL + multi-toggle) +
// compteur d'events. CONTRÔLÉ par CalendarFilterProvider (2026-07-12) : la
// bascule est instantanée, plus de navigation. La rangée de portée
// « My groups / Everyone » est SUPPRIMÉE — elle doublonnait le bloc Filters
// de la sidebar (Reset / My groups), retour Rudy.
export function FilterChips() {
  const { activeTypes, toggleType, events } = useCalendarFilters()

  const chipBase =
    'label-data-inline inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[9px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 cursor-pointer'

  return (
    <div className="space-y-2">
      <div className="-mx-3 flex scrollbar-thin gap-1.5 overflow-x-auto px-3 md:mx-0 md:px-0">
        <button
          type="button"
          onClick={() => toggleType(null)}
          aria-pressed={activeTypes.length === 0}
          className={cn(
            chipBase,
            activeTypes.length === 0
              ? 'bg-foreground text-background'
              : 'bg-secondary text-muted-foreground hover:text-foreground',
          )}
        >
          All
        </button>
        {FILTERABLE_EVENT_TYPES.map((type) => {
          const color = EVENT_TYPE_COLORS[type]
          const active = activeTypes.includes(type)
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              aria-pressed={active}
              className={cn(chipBase, !active && 'opacity-60 hover:opacity-100')}
              style={{
                color,
                backgroundColor: eventTypeTint(color),
                border: `1px solid ${eventTypeTint(color, 30)}`,
              }}
            >
              <span
                className="size-[4px] rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              {EVENT_TYPE_LABELS[type]}
            </button>
          )
        })}
        <span className="label-data-inline text-faint tabular my-auto ml-auto shrink-0 text-[9px]">
          {events.length} events
        </span>
      </div>
    </div>
  )
}
