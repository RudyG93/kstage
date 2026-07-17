'use client'

import { useState } from 'react'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { QueueRow } from '@/components/events/queue-row'
import { eventDayKey, localDayKey } from '@/lib/events/date'
import { EVENT_TYPE_COLORS } from '@/lib/events/labels'
import { cn } from '@/lib/utils'
import type { UpcomingEvent } from '@/lib/events/queries'

// THIS WEEK (§7.1.5) : 7 cellules jour (abréviation condensée, date Space
// Grotesk, dots couleur type). Clic sur un jour → ses events s'affichent
// inline sous la rangée (les données sont déjà chargées) ; le lien du header
// reste la porte vers le calendrier complet.
export function WeekGlance({
  events,
  timeZone,
  note,
}: {
  events: readonly UpcomingEvent[]
  timeZone: string
  /** « All groups » quand la semaine affiche le repli global (audit §8.4). */
  note?: string
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const now = new Date()
  const eventsByDay = new Map<string, UpcomingEvent[]>()
  for (const e of events) {
    const key = eventDayKey(e, timeZone)
    const list = eventsByDay.get(key) ?? []
    list.push(e)
    eventsByDay.set(key, list)
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() + i * 86_400_000)
    const iso = d.toISOString()
    const key = localDayKey(iso, timeZone)
    const dayEvents = eventsByDay.get(key) ?? []
    return {
      key,
      weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(d),
      dayNum: new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone }).format(d),
      isToday: i === 0,
      dots: dayEvents.slice(0, 3).map((e) => EVENT_TYPE_COLORS[e.type]),
      count: dayEvents.length,
    }
  })

  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone })
    .format(now)
    .toUpperCase()
  const selectedEvents = selectedKey ? (eventsByDay.get(selectedKey) ?? []) : []

  return (
    <Panel>
      <PanelHeader
        label="This week"
        note={note}
        action={{ label: monthLabel, href: '/calendar' }}
      />
      <div className="grid grid-cols-7 gap-1.5 p-3">
        {days.map((day) => {
          const isSelected = selectedKey === day.key
          return (
            <button
              key={day.key}
              type="button"
              onClick={() => setSelectedKey(isSelected ? null : day.key)}
              aria-pressed={isSelected}
              aria-label={`${day.weekday} ${day.dayNum}, ${day.count} event${day.count === 1 ? '' : 's'}`}
              className={cn(
                'focus-visible:ring-ring/50 flex flex-col items-center rounded-md border px-0 pt-1.5 pb-2 transition-colors outline-none focus-visible:ring-2',
                day.isToday
                  ? 'bg-primary/10 border-primary/55'
                  : 'bg-secondary hover:border-border border-transparent',
                isSelected && 'ring-primary/60 ring-2',
              )}
            >
              <span
                className={cn(
                  'label-data-inline text-[9px]',
                  day.isToday ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {day.weekday}
              </span>
              <span className="tabular mt-0.5 mb-1 text-[13px] font-semibold">{day.dayNum}</span>
              <span className="flex h-[4px] items-center gap-[3px]" aria-hidden>
                {day.dots.map((color, i) => (
                  <span
                    key={i}
                    className="size-[4px] rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>
      {selectedKey && (
        <div className="border-t">
          {selectedEvents.length === 0 ? (
            <p className="text-muted-foreground px-3 py-4 text-center text-xs">
              Nothing scheduled this day.
            </p>
          ) : (
            <div className="divide-y">
              {selectedEvents.map((event) => (
                <QueueRow key={event.id} event={event} timeZone={timeZone} />
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}
