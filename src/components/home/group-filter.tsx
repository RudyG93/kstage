'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'kstage.filter.groups'

// Filtre multi-groupes pour le calendrier : bouton → panneau avec recherche +
// checkboxes + actions (My groups / Reset). État dans `?group=<csv de slugs>`.
// Persistence hybride (§3.3) : l'URL fait foi, mais le dernier choix est mémorisé
// en localStorage et restauré au chargement quand aucun param n'est présent.
export function GroupFilter({
  groups,
  followedSlugs = [],
}: {
  groups: { slug: string; name: string }[]
  followedSlugs?: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const param = searchParams.get('group')
  const selected = new Set((param ?? '').split(',').filter(Boolean))

  const [q, setQ] = useState('')
  const reconciled = useRef(false)

  function writeUrl(csv: string, mode: 'push' | 'replace') {
    const params = new URLSearchParams(searchParams.toString())
    if (csv) params.set('group', csv)
    else params.delete('group')
    window.localStorage.setItem(STORAGE_KEY, csv)
    const qs = params.toString()
    const url = qs ? `${pathname}?${qs}` : pathname
    if (mode === 'replace') router.replace(url)
    else router.push(url)
  }

  // Réconciliation au montage (une fois) : précédence param URL > dernier choix
  // mémorisé > groupes suivis (§3.2). `''` mémorisé = "All groups" explicite.
  useEffect(() => {
    if (reconciled.current) return
    reconciled.current = true
    if (param !== null) {
      window.localStorage.setItem(STORAGE_KEY, param)
      return
    }
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      if (stored !== '') writeUrl(stored, 'replace')
      return
    }
    if (followedSlugs.length > 0) writeUrl(followedSlugs.join(','), 'replace')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? groups.filter((g) => g.name.toLowerCase().includes(needle)) : groups
  }, [groups, q])

  function toggle(slug: string) {
    const next = new Set(selected)
    if (next.has(slug)) next.delete(slug)
    else next.add(slug)
    writeUrl([...next].join(','), 'push')
  }

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
            const checked = selected.has(g.slug)
            return (
              <li key={g.slug}>
                <button
                  type="button"
                  onClick={() => toggle(g.slug)}
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
          onClick={() => writeUrl('', 'push')}
          className="label-data-inline text-muted-foreground hover:text-foreground flex-1 cursor-pointer rounded-sm px-2 py-1.5 text-[9px]"
        >
          Reset
        </button>
        {followedSlugs.length > 0 && (
          <button
            type="button"
            onClick={() => writeUrl(followedSlugs.join(','), 'push')}
            className="label-data-inline bg-primary text-primary-foreground hover:bg-primary/90 flex-1 cursor-pointer rounded-sm px-2 py-1.5 text-[9px]"
          >
            My groups
          </button>
        )}
      </div>
    </div>
  )
}
