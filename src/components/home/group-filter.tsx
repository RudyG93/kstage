'use client'

import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { useCalendarFilters } from '@/components/calendar/calendar-filters'
import { cn } from '@/lib/utils'

// Filtre multi-groupes du calendrier : recherche + checkboxes + actions
// (My groups / Reset). CONTRÔLÉ par CalendarFilterProvider depuis 2026-07-12 —
// plus aucun param d'URL ni navigation : la coche filtre en mémoire,
// instantanément (retour Rudy « le tri par URL est lent »). La persistance
// localStorage vit dans le provider.
export function GroupFilter({ groups }: { groups: { slug: string; name: string }[] }) {
  const { selectedSlugs, toggleSlug, reset, selectMyGroups, followedSlugs } = useCalendarFilters()
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? groups.filter((g) => g.name.toLowerCase().includes(needle)) : groups
  }, [groups, q])

  // Liste inline (retour Rudy 2026-07-03) : plus de menu déroulant — le filtre
  // vit à plat dans la sidebar (recherche + checkboxes + actions visibles).
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search groups…"
        aria-label="Search groups to filter"
        className="bg-secondary focus-visible:ring-ring/50 h-8 w-full rounded-[7px] border px-2.5 text-xs outline-none focus-visible:ring-2"
      />
      <ul className="max-h-56 scrollbar-thin overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="text-muted-foreground px-1 py-2 text-xs">No match.</li>
        ) : (
          filtered.map((g) => {
            const checked = selectedSlugs.has(g.slug)
            return (
              <li key={g.slug}>
                <button
                  type="button"
                  onClick={() => toggleSlug(g.slug)}
                  aria-pressed={checked}
                  className="hover:bg-muted/50 flex w-full cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1.5 text-left text-xs"
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                      checked
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-input',
                    )}
                    aria-hidden
                  >
                    {checked && <Check className="size-3" />}
                  </span>
                  <span className="truncate">{g.name}</span>
                </button>
              </li>
            )
          })
        )}
      </ul>
      <div className="flex gap-2 border-t pt-2">
        <button
          type="button"
          onClick={reset}
          className="label-data-inline text-muted-foreground hover:text-foreground flex-1 cursor-pointer rounded-sm px-2 py-1.5 text-[9px]"
        >
          Reset
        </button>
        {followedSlugs.length > 0 && (
          <button
            type="button"
            onClick={selectMyGroups}
            className="label-data-inline bg-primary text-primary-foreground hover:bg-primary/90 flex-1 cursor-pointer rounded-sm px-2 py-1.5 text-[9px]"
          >
            My groups
          </button>
        )}
      </div>
    </div>
  )
}
