'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/avatar'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

export type PickerItem = { id: string; name: string; avatar: string | null; subtitle?: string }
type Current = { name: string; avatar: string | null } | null

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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? items.filter(
          (i) =>
            i.name.toLowerCase().includes(needle) ||
            (i.subtitle?.toLowerCase().includes(needle) ?? false),
        )
      : items
    return list.slice(0, 60)
  }, [items, q])

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
        className="bg-card ring-foreground/10 hover:bg-muted/40 flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-xl p-3 text-left ring-1 transition-colors"
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
              filtered.map((item) => (
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
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
