'use client'

import { useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { groupEventsByEventDay, localDayKey } from '@/lib/events/date'
import { clusterByGroup } from '@/lib/events/grouping'
import { EVENT_TYPE_COLORS } from '@/lib/events/labels'
import { Panel } from '@/components/ui/panel'
import { QueueRow } from '@/components/events/queue-row'
import type { UpcomingEvent } from '@/lib/events/queries'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Ordre canonique des dots (un par type d'event présent ce jour-là).
type DotType = keyof typeof EVENT_TYPE_COLORS
const TYPE_ORDER = Object.keys(EVENT_TYPE_COLORS) as DotType[]
const MAX_DOTS = 3

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Calendrier Data Desk (§7.2) : pager panneau ‹ JUL 2026 ›, cellules 44px
// rounded-[7px] à dots 4px, jours hors-mois faint, listes denses par jour
// sous la grille (QueueRow + countdown inline pour les events du soir).
export function CalendarMonth({
  year,
  month,
  events,
  timeZone,
  onNavigate,
  loading = false,
}: {
  year: number
  month: number
  events: UpcomingEvent[]
  timeZone: string
  /** Navigation de mois 100 % client (round 2026-07-18) — sans lui, repli
   * sur les <Link ?month=> historiques (tests unitaires, usages isolés). */
  onNavigate?: (year: number, month: number) => void
  loading?: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Chronologie + clustering par groupe (R6) : deux events du même groupe le
  // même jour se suivent dans la liste.
  const byDay = new Map(
    [...groupEventsByEventDay(events, timeZone)].map(([k, v]) => [k, clusterByGroup(v)]),
  )

  const monthPrefix = `${year}-${pad(month)}`
  const todayKey = localDayKey(new Date().toISOString(), timeZone)
  // `?day=YYYY-MM-DD` préselectionne un jour (deep-link WeekGlance / feed).
  const dayParam = searchParams.get('day')
  const initialSelectedKey =
    dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) && dayParam.startsWith(monthPrefix)
      ? dayParam
      : null
  const [selectedKey, setSelectedKey] = useState<string | null>(initialSelectedKey)

  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prevMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate()
  // Jours hors-mois affichés en faint (mockup) : fin du mois précédent +
  // début du suivant pour compléter la dernière semaine.
  const trailing = (7 - ((firstWeekday + daysInMonth) % 7)) % 7
  const cells: { day: number; inMonth: boolean }[] = [
    ...Array.from({ length: firstWeekday }, (_, i) => ({
      day: prevMonthDays - firstWeekday + 1 + i,
      inMonth: false,
    })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, inMonth: true })),
    ...Array.from({ length: trailing }, (_, i) => ({ day: i + 1, inMonth: false })),
  ]

  const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .toUpperCase()

  function monthHref(targetYear: number, targetMonth: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', `${targetYear}-${pad(targetMonth)}`)
    params.delete('day')
    // Base = usePathname() (string) → cast : la query preserve la route courante.
    return `${pathname}?${params.toString()}` as Route
  }

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }

  // Listes par jour : le jour sélectionné seul, sinon tous les jours à venir du
  // mois (aujourd'hui inclus) — ou tout le mois s'il est déjà passé.
  const dayKeys = [...byDay.keys()].sort()
  const upcomingKeys = dayKeys.filter((k) => k >= todayKey)
  const listedKeys = selectedKey ? [selectedKey] : upcomingKeys.length > 0 ? upcomingKeys : dayKeys

  const dayTitle = (key: string) => {
    const label = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
      .format(new Date(`${key}T00:00:00Z`))
      .toUpperCase()
    return key === todayKey ? `${label} — TODAY` : label
  }

  const arrowClass =
    'hover:bg-hover focus-visible:ring-ring/50 inline-flex size-7 items-center justify-center rounded-sm outline-none focus-visible:ring-2'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[17px] font-extrabold tracking-[-0.01em]">Calendar</h1>
        <div className="bg-secondary flex items-center gap-0.5 rounded-md border p-0.5">
          {onNavigate ? (
            <button
              type="button"
              onClick={() => onNavigate(prev.y, prev.m)}
              aria-label="Previous month"
              className={arrowClass}
            >
              <ChevronLeftIcon className="size-[13px]" />
            </button>
          ) : (
            <Link
              href={monthHref(prev.y, prev.m)}
              aria-label="Previous month"
              className={arrowClass}
            >
              <ChevronLeftIcon className="size-[13px]" />
            </Link>
          )}
          <span className={`tabular px-1.5 text-xs font-semibold ${loading ? 'opacity-60' : ''}`}>
            {monthShort} {year}
          </span>
          {onNavigate ? (
            <button
              type="button"
              onClick={() => onNavigate(next.y, next.m)}
              aria-label="Next month"
              className={arrowClass}
            >
              <ChevronRightIcon className="size-[13px]" />
            </button>
          ) : (
            <Link href={monthHref(next.y, next.m)} aria-label="Next month" className={arrowClass}>
              <ChevronRightIcon className="size-[13px]" />
            </Link>
          )}
        </div>
      </div>

      <Panel>
        <div className="grid grid-cols-7 gap-1 p-2.5">
          {WEEKDAYS.map((w) => (
            <div key={w} className="label-data-inline text-faint py-1 text-center text-[9px]">
              {w}
            </div>
          ))}
          {cells.map(({ day, inMonth }, i) => {
            if (!inMonth) {
              return (
                <div
                  key={`out-${i}`}
                  className="tabular text-faint/60 flex h-11 items-start justify-center pt-1.5 text-[11px]"
                  aria-hidden
                >
                  {day}
                </div>
              )
            }
            const key = `${monthPrefix}-${pad(day)}`
            const dayEvents = byDay.get(key) ?? []
            const dayTypes = TYPE_ORDER.filter((t) => dayEvents.some((e) => e.type === t))
            const shownTypes = dayTypes.slice(0, MAX_DOTS)
            const isSelected = selectedKey === key
            const isToday = todayKey === key
            // Ring réservé aux jours de comeback (mv/release), pas à tout event (§7.2).
            const hasComeback = dayEvents.some((e) => e.type === 'mv' || e.type === 'release')
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(isSelected ? null : key)}
                aria-pressed={isSelected}
                aria-label={`${monthShort} ${day}, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`}
                className={cn(
                  'focus-visible:ring-ring/50 flex h-11 flex-col items-center rounded-[7px] pt-1.5 outline-none focus-visible:ring-2',
                  isToday
                    ? 'bg-primary/12 border-primary/60 border'
                    : 'bg-secondary hover:bg-hover border border-transparent',
                  isSelected && 'ring-primary/60 ring-2',
                  hasComeback && !isToday && !isSelected && 'ring-primary/35 ring-1 ring-inset',
                )}
              >
                <span
                  className={cn(
                    'tabular text-[11px] leading-none font-semibold',
                    isToday && 'text-primary',
                  )}
                >
                  {day}
                </span>
                <span className="mt-1 flex h-[4px] items-center gap-[2px]" aria-hidden>
                  {shownTypes.map((t) => (
                    <span
                      key={t}
                      className="size-[4px] rounded-full"
                      style={{ backgroundColor: EVENT_TYPE_COLORS[t] }}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </Panel>

      {listedKeys.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-12 text-center text-sm">
          No events this month.
        </div>
      ) : (
        listedKeys.map((key) => {
          const dayEvents = byDay.get(key) ?? []
          if (dayEvents.length === 0) {
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-baseline justify-between px-1">
                  <span className="label-data">{dayTitle(key)}</span>
                  <span className="label-data-inline text-faint text-[9px]">0 events</span>
                </div>
                <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-8 text-center text-sm">
                  No events this day.
                </div>
              </div>
            )
          }
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-baseline justify-between px-1">
                <span className="label-data">{dayTitle(key)}</span>
                <span className="label-data-inline text-faint tabular text-[9px]">
                  {dayEvents.length} event{dayEvents.length === 1 ? '' : 's'}
                </span>
              </div>
              <Panel>
                <div className="divide-y">
                  {dayEvents.map((event) => (
                    <QueueRow
                      key={event.id}
                      event={event}
                      timeZone={timeZone}
                      showThumb
                      withCountdown
                      lineupDisplay="full"
                    />
                  ))}
                </div>
              </Panel>
            </div>
          )
        })
      )}
    </div>
  )
}
