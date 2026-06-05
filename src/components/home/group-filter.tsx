'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'
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

  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="border-input bg-background hover:bg-muted/40 flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-3 text-sm font-medium"
      >
        <span className="truncate">
          {selected.size > 0
            ? `${selected.size} group${selected.size > 1 ? 's' : ''}`
            : 'All groups'}
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
      </button>

      {open && (
        <div className="bg-card ring-foreground/10 absolute z-20 mt-1 w-full overflow-hidden rounded-lg shadow-lg ring-1">
          <div className="border-border border-b p-2">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search groups…"
              className="focus-visible:ring-ring/50 h-8 w-full rounded-md border-0 bg-transparent px-2 text-sm outline-none focus-visible:ring-2"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="text-muted-foreground px-2 py-2 text-sm">No match.</li>
            ) : (
              filtered.map((g) => {
                const checked = selected.has(g.slug)
                return (
                  <li key={g.slug}>
                    <button
                      type="button"
                      onClick={() => toggle(g.slug)}
                      aria-pressed={checked}
                      className="hover:bg-muted/50 flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
                    >
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded border',
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
          <div className="border-border flex gap-2 border-t p-2">
            <button
              type="button"
              onClick={() => writeUrl('', 'push')}
              className="hover:bg-muted/50 flex-1 cursor-pointer rounded px-2 py-1.5 text-sm font-medium"
            >
              Reset
            </button>
            {followedSlugs.length > 0 && (
              <button
                type="button"
                onClick={() => writeUrl(followedSlugs.join(','), 'push')}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 cursor-pointer rounded px-2 py-1.5 text-sm font-medium"
              >
                My groups
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
