import Link from 'next/link'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { localDayKey } from '@/lib/events/date'
import { EVENT_TYPE_COLORS } from '@/lib/events/labels'
import { cn } from '@/lib/utils'
import type { UpcomingEvent } from '@/lib/events/queries'

// THIS WEEK (§7.1.5) : 7 cellules jour (abréviation condensée, date Space
// Grotesk, dots 4px couleur type). Aujourd'hui = fond/bord primary. → /calendar.
export function WeekGlance({
  events,
  timeZone,
}: {
  events: readonly UpcomingEvent[]
  timeZone: string
}) {
  const now = new Date()
  const dotsByDay = new Map<string, string[]>()
  for (const e of events) {
    const key = localDayKey(e.start_at, timeZone)
    const dots = dotsByDay.get(key) ?? []
    if (dots.length < 3) dots.push(EVENT_TYPE_COLORS[e.type])
    dotsByDay.set(key, dots)
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() + i * 86_400_000)
    const iso = d.toISOString()
    return {
      key: localDayKey(iso, timeZone),
      weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(d),
      dayNum: new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone }).format(d),
      isToday: i === 0,
      dots: dotsByDay.get(localDayKey(iso, timeZone)) ?? [],
    }
  })

  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone })
    .format(now)
    .toUpperCase()

  return (
    <Panel>
      <PanelHeader label="This week" action={{ label: monthLabel, href: '/calendar' }} />
      <div className="grid grid-cols-7 gap-1.5 p-3">
        {days.map((day) => (
          <Link
            key={day.key}
            href={`/calendar?day=${day.key}`}
            className={cn(
              'flex flex-col items-center rounded-[8px] border px-0 pt-1.5 pb-2 transition-colors',
              day.isToday
                ? 'bg-primary/10 border-primary/55'
                : 'bg-secondary hover:border-border border-transparent',
            )}
          >
            <span
              className={cn(
                'label-data-inline text-[8.5px]',
                day.isToday ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {day.weekday}
            </span>
            <span className="tabular mt-0.5 mb-1 text-[13px] font-semibold">{day.dayNum}</span>
            <span className="flex h-[4px] items-center gap-[3px]">
              {day.dots.map((color, i) => (
                <span
                  key={i}
                  className="size-[4px] rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
              ))}
            </span>
          </Link>
        ))}
      </div>
    </Panel>
  )
}
