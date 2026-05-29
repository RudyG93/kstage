'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { groupEventsByKstDay, kstDayKey } from '@/lib/events/date'
import { HomeEventCard } from '@/components/home/event-card'
import type { UpcomingEvent } from '@/lib/events/queries'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function CalendarMonth({
  year,
  month,
  events,
}: {
  year: number
  month: number
  events: UpcomingEvent[]
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const byDay = groupEventsByKstDay(events)

  const monthPrefix = `${year}-${pad(month)}`
  const todayKey = kstDayKey(new Date().toISOString())
  const [selectedKey, setSelectedKey] = useState<string | null>(
    todayKey.startsWith(monthPrefix) ? todayKey : null,
  )

  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const monthTitle = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))

  function monthHref(targetYear: number, targetMonth: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', `${targetYear}-${pad(targetMonth)}`)
    return `${pathname}?${params.toString()}`
  }

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }

  const selectedEvents = selectedKey ? (byDay.get(selectedKey) ?? []) : []
  const selectedTitle = selectedKey
    ? new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${selectedKey}T00:00:00Z`))
    : null

  const arrowClass =
    'hover:bg-muted focus-visible:ring-ring/50 inline-flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-3'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href={monthHref(prev.y, prev.m)} aria-label="Previous month" className={arrowClass}>
          <ChevronLeftIcon className="size-5" />
        </Link>
        <h2 className="text-sm font-medium">{monthTitle}</h2>
        <Link href={monthHref(next.y, next.m)} aria-label="Next month" className={arrowClass}>
          <ChevronRightIcon className="size-5" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-muted-foreground py-1 text-xs font-medium">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />
          const key = `${monthPrefix}-${pad(day)}`
          const dayEvents = byDay.get(key) ?? []
          const colors = Array.from(
            new Set(dayEvents.map((e) => e.groups?.color_hex).filter(Boolean) as string[]),
          ).slice(0, 3)
          const isSelected = selectedKey === key
          const isToday = todayKey === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              aria-pressed={isSelected}
              aria-label={`${monthTitle} ${day}, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`}
              className={cn(
                'focus-visible:ring-ring/50 relative flex aspect-square flex-col items-center justify-center gap-1 rounded-md text-sm outline-none focus-visible:ring-3',
                isSelected ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted',
                isToday && !isSelected && 'ring-ring/50 ring-1',
              )}
            >
              <span>{day}</span>
              {colors.length > 0 && (
                <span className="flex gap-0.5" aria-hidden>
                  {colors.map((c, j) => (
                    <span
                      key={j}
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">{selectedTitle ?? 'Select a day'}</h3>
        {selectedEvents.length === 0 ? (
          <div className="border-border/70 text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center text-sm">
            No events this day.
          </div>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map((event) => (
              <HomeEventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
