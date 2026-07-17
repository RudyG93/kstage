'use client'

import { useDeferredValue, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/avatar'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

export type PickerItem = { id: string; name: string; avatar: string | null; subtitle?: string }
type Current = { name: string; avatar: string | null } | null

// Rendu incrémental : l'ancien cap dur `.slice(0, 60)` tronquait la liste par
// défaut à « Chanelle Moon » (rang 60/841 — retour Rudy 2026-07-17). On rend
// par tranches de 100, étendues quand la sentinelle de bas de liste entre dans
// le viewport — la liste COMPLÈTE reste atteignable au scroll.
const PAGE = 100

// Cadre éditable Bias / Favorite : ouvre une modale recherche + liste d'avatars.
export function ProfilePicker({
  label,
  current,
  items,
  onSelect,
}: {
  label: string
  current: Current
  items: PickerItem[]
  onSelect: (id: string | null) => Promise<{ error: string } | { ok: true }>
}) {
  const router = useRouter()
  const [value, setValue] = useState<Current>(current)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [, startTransition] = useTransition()
  const [visibleCount, setVisibleCount] = useState(PAGE)
  // Saisie fluide sur 841 items : le filtre suit la frappe en différé.
  const deferredQ = useDeferredValue(q)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Nouvelle recherche → repartir de la première tranche (ajustement d'état
  // pendant le render, pattern React officiel — pas de setState-in-effect).
  const [lastQ, setLastQ] = useState(deferredQ)
  if (lastQ !== deferredQ) {
    setLastQ(deferredQ)
    setVisibleCount(PAGE)
  }

  const filtered = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase()
    return needle
      ? items.filter(
          (i) =>
            i.name.toLowerCase().includes(needle) ||
            (i.subtitle?.toLowerCase().includes(needle) ?? false),
        )
      : items
  }, [items, deferredQ])
  const visible = filtered.slice(0, visibleCount)

  // Sentinelle via callback-ref : observée à son montage, déconnectée à son
  // retrait (elle disparaît quand toute la liste est rendue).
  const sentinelRef = (node: HTMLLIElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisibleCount((c) => c + PAGE)
    })
    io.observe(node)
    observerRef.current = io
  }

  function pick(item: PickerItem | null) {
    const previous = value
    setValue(item ? { name: item.name, avatar: item.avatar } : null)
    setOpen(false)
    startTransition(async () => {
      const res = await onSelect(item?.id ?? null)
      if ('error' in res) {
        setValue(previous)
        toast.error(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-card hover:bg-muted/40 flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-left transition-colors"
      >
        {value ? (
          <>
            <Avatar username={value.name} avatarUrl={value.avatar} size={36} />
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</p>
              <p className="truncate text-sm font-medium">{value.name}</p>
            </div>
          </>
        ) : (
          <>
            <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-full">
              <Plus className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</p>
              <p className="text-muted-foreground truncate text-sm">Set {label.toLowerCase()}</p>
            </div>
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Choose your {label.toLowerCase()}</DialogTitle>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="border-input bg-background focus-visible:ring-ring/50 mt-3 h-9 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2"
          />
          {value && (
            <button
              type="button"
              onClick={() => pick(null)}
              className="text-muted-foreground hover:text-destructive mt-2 inline-flex items-center gap-1 text-xs"
            >
              <X className="size-3.5" aria-hidden />
              Clear {label.toLowerCase()}
            </button>
          )}
          <ul className="mt-2 max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="text-muted-foreground px-2 py-3 text-sm">No match.</li>
            ) : (
              <>
                {visible.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => pick(item)}
                      className="hover:bg-muted/50 flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left"
                    >
                      <Avatar username={item.name} avatarUrl={item.avatar} size={32} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{item.name}</span>
                        {item.subtitle && (
                          <span className="text-muted-foreground block truncate text-xs">
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
                {visible.length < filtered.length && (
                  <li ref={sentinelRef} aria-hidden className="h-10" />
                )}
              </>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
