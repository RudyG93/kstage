'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  FILTERABLE_EVENT_TYPES,
  eventTypeTint,
} from '@/lib/events/labels'
import { parseTypesParam } from '@/lib/events/filters'
import { cn } from '@/lib/utils'

// Chips de filtres Calendar (§7.2) : rangée types (ALL + multi-toggle) +
// rangée portée MY GROUPS / EVERYONE + compteur d'events. URL-driven.
export function FilterChips({ eventCount, isAuthed }: { eventCount: number; isAuthed: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTypes = parseTypesParam(searchParams.get('type') ?? undefined)
  const scope = searchParams.get('scope') === 'mine' ? 'mine' : 'everyone'

  const withParams = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const typeHref = (type: string | null) =>
    withParams((p) => {
      if (type === null) {
        p.delete('type')
        return
      }
      const next = activeTypes.includes(type as (typeof activeTypes)[number])
        ? activeTypes.filter((t) => t !== type)
        : [...activeTypes, type]
      if (next.length === 0) p.delete('type')
      else p.set('type', next.join(','))
    })

  const scopeHref = (target: 'mine' | 'everyone') =>
    withParams((p) => {
      if (target === 'mine') p.set('scope', 'mine')
      else p.delete('scope')
    })

  const chipBase =
    'label-data-inline inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[9px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

  return (
    <div className="space-y-2">
      <div className="-mx-3 flex scrollbar-thin gap-1.5 overflow-x-auto px-3 md:mx-0 md:px-0">
        <Link
          href={typeHref(null)}
          aria-current={activeTypes.length === 0 ? 'true' : undefined}
          className={cn(
            chipBase,
            activeTypes.length === 0
              ? 'bg-foreground text-background'
              : 'bg-secondary text-muted-foreground hover:text-foreground',
          )}
        >
          All
        </Link>
        {FILTERABLE_EVENT_TYPES.map((type) => {
          const color = EVENT_TYPE_COLORS[type]
          const active = activeTypes.includes(type)
          return (
            <Link
              key={type}
              href={typeHref(type)}
              aria-current={active ? 'true' : undefined}
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
            </Link>
          )
        })}
      </div>
      <div className="flex items-center gap-1.5">
        {isAuthed && (
          <>
            <Link
              href={scopeHref('mine')}
              aria-current={scope === 'mine' ? 'true' : undefined}
              className={cn(
                chipBase,
                scope === 'mine'
                  ? 'bg-foreground text-background'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              My groups
            </Link>
            <Link
              href={scopeHref('everyone')}
              aria-current={scope === 'everyone' ? 'true' : undefined}
              className={cn(
                chipBase,
                scope === 'everyone'
                  ? 'bg-foreground text-background'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              Everyone
            </Link>
          </>
        )}
        <span className="label-data-inline text-faint tabular ml-auto text-[9px]">
          {eventCount} events
        </span>
      </div>
    </div>
  )
}
