'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { GroupCard, type NextEventInfo } from '@/components/group-card'
import type { GroupSummary } from '@/lib/groups/queries'

export type GroupGridItem = {
  group: GroupSummary
  isFollowing: boolean
  isAuthed: boolean
  href?: string
  nextEvent?: NextEventInfo | null
}

/**
 * Grille de groupes avec recherche live (§5.1). La liste (déjà triée) est rendue
 * côté serveur puis filtrée côté client par nom — filtrage instantané à la frappe
 * via useDeferredValue pour garder la saisie fluide.
 */
export function GroupsGrid({ items }: { items: GroupGridItem[] }) {
  const [q, setQ] = useState('')
  const deferredQ = useDeferredValue(q)

  const filtered = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase()
    if (!needle) return items
    return items.filter((it) => it.group.name.toLowerCase().includes(needle))
  }, [items, deferredQ])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search groups…"
          aria-label="Search groups"
          className="border-input bg-background focus-visible:ring-ring/50 h-10 w-full rounded-lg border pr-3 pl-9 text-sm outline-none focus-visible:ring-2"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">No group matches “{q}”.</p>
      ) : (
        <div className="grid grid-cols-2 gap-[9px] md:grid-cols-3">
          {filtered.map((it) => (
            <GroupCard
              key={it.group.slug}
              group={it.group}
              isFollowing={it.isFollowing}
              isAuthed={it.isAuthed}
              href={it.href}
              nextEvent={it.nextEvent}
            />
          ))}
        </div>
      )}
    </div>
  )
}
