'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Panel } from '@/components/ui/panel'
import {
  createLineupArtist,
  ignoreLineupUnmatched,
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
  const [, startTransition] = useTransition()

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">No unmatched lineup artists.</p>
  }

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
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.name_norm}>
          <Panel>
            <div className="flex flex-wrap items-center gap-2 p-3">
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
  )
}
