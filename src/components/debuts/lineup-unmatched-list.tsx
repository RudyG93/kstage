'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Panel } from '@/components/ui/panel'
import {
  createLineupArtist,
  createLineupArtistsBulk,
  ignoreLineupUnmatched,
  ignoreLineupUnmatchedBulk,
  type LineupUnmatchedRow,
} from '@/lib/debuts/actions'

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso))

/**
 * File « artistes de lineup hors-app » (retour Rudy 2026-07-17) : les noms des
 * lineups music-show qui ne matchent aucun groupe du roster, triés par
 * récurrence. Create = pipeline fandom complet (groupe + membres + chaîne YT +
 * enrichissements crons) ; Ignore = bruit / hors-scope.
 */
export function LineupUnmatchedList({ items }: { items: LineupUnmatchedRow[] }) {
  const [rows, setRows] = useState(items)
  const [busy, setBusy] = useState<string | null>(null)
  const [bulkPending, startTransition] = useTransition()
  // Bulk-triage (2026-08-07) : le bruit s'ignore par lot, pas clic par clic.
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">No unmatched lineup artists.</p>
  }

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const ignoreSelected = () =>
    startTransition(async () => {
      const names = [...selected]
      const res = await ignoreLineupUnmatchedBulk(names)
      if (res.error) {
        toast.error(res.error)
        return
      }
      const done = new Set(names)
      setRows((prev) => prev.filter((r) => !done.has(r.name_norm)))
      setSelected(new Set())
      toast.success(`${res.ignored ?? 0} ignored`)
    })

  // Bulk create (retour Rudy 2026-08-20 : la sélection ne servait qu'à
  // ignorer). Chaque création = dossier fandom complet → borné côté serveur ;
  // les échecs restent listés (et en file) pour une création manuelle.
  const createSelected = () =>
    startTransition(async () => {
      const names = [...selected]
      let res: Awaited<ReturnType<typeof createLineupArtistsBulk>>
      try {
        res = await createLineupArtistsBulk(names)
      } catch {
        toast.error('Interrompu (timeout ?) — recharge la page pour voir l’état réel')
        return
      }
      if (res.error) {
        toast.error(res.error)
        return
      }
      // Restent affichées : les non-sélectionnées + les sélectionnées en échec
      // (toujours pending côté serveur, à re-tenter ou créer à la main).
      const chosen = new Set(names)
      const failed = new Set((res.errors ?? []).map((e) => e.split(':')[0]))
      setRows((prev) => prev.filter((r) => !chosen.has(r.name_norm) || failed.has(r.display_name)))
      setSelected(new Set())
      if ((res.errors ?? []).length > 0) toast.error(res.errors!.join(' · '))
      toast.success(`${res.created ?? 0} created`)
    })

  const decide = (nameNorm: string, action: 'create' | 'ignore') => {
    setBusy(nameNorm)
    startTransition(async () => {
      const res =
        action === 'create'
          ? await createLineupArtist(nameNorm)
          : await ignoreLineupUnmatched(nameNorm)
      setBusy(null)
      if (res.error) {
        toast.error(res.error)
        // « déjà en base » sort aussi l'entrée de la file pending.
        if (res.error.includes('ignorée')) {
          setRows((prev) => prev.filter((r) => r.name_norm !== nameNorm))
        }
        return
      }
      setRows((prev) => prev.filter((r) => r.name_norm !== nameNorm))
      toast.success(action === 'create' ? 'Artist created via fandom' : 'Ignored')
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={bulkPending || selected.size === 0}
          onClick={createSelected}
          className="label-data-inline bg-primary text-primary-foreground cursor-pointer rounded-sm px-3 py-1.5 text-[9px] disabled:opacity-50"
        >
          Create selected ({selected.size})
        </button>
        <button
          type="button"
          disabled={bulkPending || selected.size === 0}
          onClick={ignoreSelected}
          className="label-data-inline bg-secondary text-muted-foreground hover:text-foreground cursor-pointer rounded-sm px-3 py-1.5 text-[9px] disabled:opacity-50"
        >
          Ignore selected ({selected.size})
        </button>
        <button
          type="button"
          disabled={bulkPending}
          onClick={() =>
            setSelected((prev) =>
              prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.name_norm)),
            )
          }
          className="label-data-inline text-faint hover:text-foreground ml-auto cursor-pointer text-[9px]"
        >
          {selected.size === rows.length ? 'Clear' : `Select all (${rows.length})`}
        </button>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name_norm}>
            <Panel>
              <div className="flex flex-wrap items-center gap-2 p-3">
                <input
                  type="checkbox"
                  checked={selected.has(r.name_norm)}
                  onChange={() => toggle(r.name_norm)}
                  aria-label={`Select ${r.display_name}`}
                  className="accent-primary size-3.5 cursor-pointer"
                />
                <span className="text-xs font-semibold">{r.display_name}</span>
                <span className="tabular text-primary text-[10px]">
                  seen ×{r.occurrences} · {when(r.last_seen)}
                </span>
                <span className="text-muted-foreground min-w-0 truncate text-[10px]">
                  {r.shows.join(', ')}
                </span>
                <span className="ml-auto flex gap-2">
                  <button
                    type="button"
                    disabled={busy === r.name_norm}
                    onClick={() => decide(r.name_norm, 'create')}
                    className="label-data-inline bg-primary text-primary-foreground cursor-pointer rounded-sm px-3 py-1.5 text-[9px] disabled:opacity-50"
                  >
                    Create via fandom
                  </button>
                  <button
                    type="button"
                    disabled={busy === r.name_norm}
                    onClick={() => decide(r.name_norm, 'ignore')}
                    className="label-data-inline bg-secondary text-muted-foreground hover:text-foreground cursor-pointer rounded-sm px-3 py-1.5 text-[9px] disabled:opacity-50"
                  >
                    Ignore
                  </button>
                </span>
              </div>
            </Panel>
          </li>
        ))}
      </ul>
    </div>
  )
}
