'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CalendarMonth } from '@/components/calendar-month'
import { groupMusicShowEpisodes, type GroupedUpcomingEvent } from '@/lib/events/grouping'
import { isSyntheticSlot } from '@/lib/events/show-slots'
import type { UpcomingEvent } from '@/lib/events/queries'

const STORAGE_KEY = 'kstage.filter.groups'

// Filtrage du calendrier 100 % CLIENT (refonte 2026-07-12, retour Rudy) :
// chaque clic de filtre déclenchait une navigation RSC complète (le filtre
// vivait dans ?group=/?type=/?scope=) → refetch du mois + régénération
// anniversaires/slots à chaque coche. Le mois entier (~50-130 events) est
// désormais chargé une fois côté serveur, et groupes/types se filtrent en
// mémoire — bascule instantanée, URL réduite à ?month (+ ?day deep-link).
// Le doublon de scope (« Everyone/My groups » sous les chips VS « My groups »
// du bloc Filters) est soldé : seul le bloc Filters porte la portée.

interface CalendarFilterState {
  /** Slugs sélectionnés — vide = tous les groupes. */
  selectedSlugs: ReadonlySet<string>
  toggleSlug: (slug: string) => void
  reset: () => void
  selectMyGroups: () => void
  followedSlugs: string[]
  /** Types actifs — vide = tous. */
  activeTypes: readonly string[]
  toggleType: (type: string | null) => void
  /** Events du mois filtrés + music shows regroupés par épisode. */
  events: GroupedUpcomingEvent[]
  /** Mois affiché + navigation 100 % client (round 2026-07-18). */
  month: { year: number; month: number }
  navigateMonth: (year: number, month: number) => void
  monthLoading: boolean
}

const Ctx = createContext<CalendarFilterState | null>(null)

export function useCalendarFilters(): CalendarFilterState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCalendarFilters outside CalendarFilterProvider')
  return ctx
}

const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`

export function CalendarFilterProvider({
  events,
  initialMonth,
  followedSlugs,
  initialSlugs,
  children,
}: {
  /** Mois ENTIER non filtré (db + anniversaires + slots synthétiques). */
  events: UpcomingEvent[]
  /** Mois du rendu initial SSR (?month= ou mois courant). */
  initialMonth: { year: number; month: number }
  followedSlugs: string[]
  /** Deep-link ?group=<csv> (liens « Calendar → » des pages groupe). */
  initialSlugs?: string[]
  children: ReactNode
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(initialSlugs ?? []))
  const [activeTypes, setActiveTypes] = useState<readonly string[]>([])
  const hydratedFromStorage = useRef(false)

  // Navigation de mois 100 % CLIENT (round 2026-07-18, demande explicite —
  // « éviter les changements via l'URL ») : cache mémoire par mois, fetch
  // /api/calendar/month (payload public, CDN 5 min), prefetch des mois
  // adjacents à l'idle, deep-link ?month= maintenu via history.replaceState.
  const [currentMonth, setCurrentMonth] = useState(initialMonth)
  const [monthEvents, setMonthEvents] = useState<UpcomingEvent[]>(events)
  const [monthLoading, setMonthLoading] = useState(false)
  // Seed dans l'initialiseur (pas d'accès .current pendant le render —
  // react-hooks/refs) : le mois SSR initial est déjà en cache.
  const monthCache = useRef(
    new Map<string, UpcomingEvent[]>([[monthKey(initialMonth.year, initialMonth.month), events]]),
  )

  const fetchMonth = async (y: number, m: number): Promise<UpcomingEvent[] | null> => {
    const key = monthKey(y, m)
    const cached = monthCache.current.get(key)
    if (cached) return cached
    try {
      const res = await fetch(`/api/calendar/month?month=${key}`)
      if (!res.ok) return null
      const data = (await res.json()) as { events: UpcomingEvent[] }
      monthCache.current.set(key, data.events)
      return data.events
    } catch {
      return null
    }
  }

  const navigateMonth = (y: number, m: number) => {
    setCurrentMonth({ year: y, month: m })
    const params = new URLSearchParams(window.location.search)
    params.set('month', monthKey(y, m))
    params.delete('day')
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
    const cached = monthCache.current.get(monthKey(y, m))
    if (cached) {
      setMonthEvents(cached)
      return
    }
    setMonthLoading(true)
    void fetchMonth(y, m).then((evts) => {
      setMonthLoading(false)
      // Ne pose le résultat que si le viewer est resté sur ce mois.
      setCurrentMonth((cur) => {
        if (cur.year === y && cur.month === m && evts) setMonthEvents(evts)
        return cur
      })
    })
  }

  // Prefetch idle des mois adjacents : la flèche suivante est instantanée.
  useEffect(() => {
    const { year, month } = currentMonth
    const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
    const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
    const t = window.setTimeout(() => {
      void fetchMonth(prev.y, prev.m)
      void fetchMonth(next.y, next.m)
    }, 600)
    return () => window.clearTimeout(t)
  }, [currentMonth])

  // Précédence au montage (reprise de l'ancien GroupFilter §3.2) : deep-link
  // URL > dernier choix mémorisé > groupes suivis. '' mémorisé = « All
  // groups » explicite.
  useEffect(() => {
    if (hydratedFromStorage.current) return
    hydratedFromStorage.current = true
    if (initialSlugs && initialSlugs.length > 0) return
    // setState-in-effect assumé : lire localStorage pendant le render SSR est
    // impossible, et l'initialiser côté client seulement créerait un mismatch
    // d'hydratation. One-shot gardé par ref (pattern react-19 documenté).
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored !== '') setSelected(new Set(stored.split(',').filter(Boolean)))
      return
    }

    if (followedSlugs.length > 0) setSelected(new Set(followedSlugs))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = (next: ReadonlySet<string>) => {
    window.localStorage.setItem(STORAGE_KEY, [...next].join(','))
    setSelected(next)
  }

  const value: CalendarFilterState = {
    selectedSlugs: selected,
    followedSlugs,
    toggleSlug: (slug) => {
      const next = new Set(selected)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      persist(next)
    },
    reset: () => persist(new Set()),
    selectMyGroups: () => persist(new Set(followedSlugs)),
    activeTypes,
    toggleType: (type) => {
      if (type === null) return setActiveTypes([])
      setActiveTypes((prev) =>
        prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
      )
    },
    events: useMemo(() => {
      const bySlug = selected.size > 0
      const filtered = monthEvents.filter((e) => {
        if (activeTypes.length > 0 && !activeTypes.includes(e.type)) return false
        if (!bySlug) return true
        // Slots synthétiques : pas de groupe → visibles seulement sans filtre
        // de groupes (même règle que l'ancien rendu serveur).
        if (isSyntheticSlot(e)) return false
        return e.groups?.slug ? selected.has(e.groups.slug) : false
      })
      return groupMusicShowEpisodes(filtered)
    }, [monthEvents, selected, activeTypes]),
    month: currentMonth,
    navigateMonth,
    monthLoading,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Pont : le mois rendu avec les events filtrés + la navigation du contexte. */
export function CalendarEvents({ timeZone }: { timeZone: string }) {
  const { events, month, navigateMonth, monthLoading } = useCalendarFilters()
  return (
    // key : remonte le composant à chaque mois — la sélection de jour (state
    // interne dérivé de ?day) ne fuit pas d'un mois à l'autre.
    <CalendarMonth
      key={`${month.year}-${month.month}`}
      year={month.year}
      month={month.month}
      events={events}
      timeZone={timeZone}
      onNavigate={navigateMonth}
      loading={monthLoading}
    />
  )
}
