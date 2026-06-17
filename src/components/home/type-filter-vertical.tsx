'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, FILTERABLE_EVENT_TYPES } from '@/lib/events/labels'
import { parseTypesParam, serializeTypesParam } from '@/lib/events/filters'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

export function TypeFilterVertical() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = new Set<EventType>(parseTypesParam(searchParams.get('type') ?? undefined))

  function pushTypes(next: Set<EventType>) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.size > 0) params.set('type', serializeTypesParam([...next]))
    else params.delete('type')
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function toggle(value: EventType) {
    const next = new Set(active)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    pushTypes(next)
  }

  const rowClass = (isActive: boolean) =>
    cn(
      'flex h-10 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-sm transition-colors duration-200',
      isActive
        ? 'bg-accent text-foreground font-semibold'
        : 'text-muted-foreground hover:bg-muted/40 font-medium',
    )

  return (
    <div className="space-y-1">
      {/* « All events » = reset (aucun filtre actif), carré sombre (maquette). */}
      <button
        type="button"
        onClick={() => pushTypes(new Set())}
        aria-pressed={active.size === 0}
        className={rowClass(active.size === 0)}
      >
        <span className="bg-foreground size-2 shrink-0 rounded-[3px]" aria-hidden />
        All events
      </button>
      {FILTERABLE_EVENT_TYPES.map((t) => {
        const isActive = active.has(t)
        return (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            aria-pressed={isActive}
            className={rowClass(isActive)}
          >
            <span
              className="size-2 shrink-0 rounded-[3px]"
              style={{ backgroundColor: EVENT_TYPE_COLORS[t] }}
              aria-hidden
            />
            {EVENT_TYPE_LABELS[t]}
          </button>
        )
      })}
    </div>
  )
}
