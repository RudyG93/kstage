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
}

const Ctx = createContext<CalendarFilterState | null>(null)

export function useCalendarFilters(): CalendarFilterState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCalendarFilters outside CalendarFilterProvider')
  return ctx
}

export function CalendarFilterProvider({
  events,
  followedSlugs,
  initialSlugs,
  children,
}: {
  /** Mois ENTIER non filtré (db + anniversaires + slots synthétiques). */
  events: UpcomingEvent[]
  followedSlugs: string[]
  /** Deep-link ?group=<csv> (liens « Calendar → » des pages groupe). */
  initialSlugs?: string[]
  children: ReactNode
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(initialSlugs ?? []))
  const [activeTypes, setActiveTypes] = useState<readonly string[]>([])
  const hydratedFromStorage = useRef(false)

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
      const filtered = events.filter((e) => {
        if (activeTypes.length > 0 && !activeTypes.includes(e.type)) return false
        if (!bySlug) return true
        // Slots synthétiques : pas de groupe → visibles seulement sans filtre
        // de groupes (même règle que l'ancien rendu serveur).
        if (isSyntheticSlot(e)) return false
        return e.groups?.slug ? selected.has(e.groups.slug) : false
      })
      return groupMusicShowEpisodes(filtered)
    }, [events, selected, activeTypes]),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Pont : le mois rendu avec les events filtrés du contexte. */
export function CalendarEvents({ year, month }: { year: number; month: number }) {
  const { events } = useCalendarFilters()
  return <CalendarMonth year={year} month={month} events={events} />
}
