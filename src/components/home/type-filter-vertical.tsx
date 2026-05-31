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

  function toggle(value: EventType) {
    const next = new Set(active)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    const params = new URLSearchParams(searchParams.toString())
    if (next.size > 0) params.set('type', serializeTypesParam([...next]))
    else params.delete('type')
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="space-y-1">
      {FILTERABLE_EVENT_TYPES.map((t) => {
        const isActive = active.has(t)
        return (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            aria-pressed={isActive}
            className={cn(
              'flex h-10 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-200',
              isActive
                ? 'bg-muted text-foreground ring-foreground/15 ring-1'
                : 'text-muted-foreground hover:bg-muted/40',
            )}
          >
            <span
              className="size-2 shrink-0 rounded-full"
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
