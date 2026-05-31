'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Filtre multi-groupes pour le calendrier : bouton → panneau avec recherche +
// checkboxes, état dans `?group=<csv de slugs>`. Fermeture au clic extérieur.
export function GroupFilter({ groups }: { groups: { slug: string; name: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selected = new Set((searchParams.get('group') ?? '').split(',').filter(Boolean))

  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

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
    const params = new URLSearchParams(searchParams.toString())
    if (next.size > 0) params.set('group', [...next].join(','))
    else params.delete('group')
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
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
        </div>
      )}
    </div>
  )
}
