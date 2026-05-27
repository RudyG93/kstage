'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, FILTERABLE_EVENT_TYPES } from '@/lib/events/labels'
import { cn } from '@/lib/utils'

export function TypeFilterVertical() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('type') ?? ''

  function setType(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== current) params.set('type', value)
    else params.delete('type')
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="space-y-1">
      {FILTERABLE_EVENT_TYPES.map((t) => {
        const active = current === t
        return (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            aria-pressed={active}
            className={cn(
              'flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-200',
              active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/40',
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
