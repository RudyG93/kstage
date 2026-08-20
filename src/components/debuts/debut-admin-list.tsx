'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Panel } from '@/components/ui/panel'
import {
  approveDebutCandidate,
  approveDebutCandidatesBulk,
  dismissDebutCandidate,
  dismissDebutCandidatesBulk,
  dismissStaleReviewQueues,
  type DebutCandidateRow,
} from '@/lib/debuts/actions'
import { cn } from '@/lib/utils'

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso))

export function DebutAdminList({ items }: { items: DebutCandidateRow[] }) {
  const [rows, setRows] = useState(items)
  const [pending, startTransition] = useTransition()
  // Bulk-triage (2026-08-07) : la file gonflait plus vite que la revue 1-par-1.
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">No debut candidates detected yet.</p>
  }

  const decide = (id: string, action: 'create' | 'dismiss') =>
    startTransition(async () => {
      const res =
        action === 'create' ? await approveDebutCandidate(id) : await dismissDebutCandidate(id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      // La file est une liste de TRAVAIL : une row décidée en sort (retour
      // Rudy 2026-08-20 — elle restait affichée avec son badge).
      setRows((prev) => prev.filter((r) => r.id !== id))
      toast.success(
        action === 'create' ? 'Created — MVs en cours de récupération (arrière-plan)' : 'Dismissed',
      )
    })

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const pendingRows = rows.filter((r) => r.status === 'pending')

  const dismissSelected = () =>
    startTransition(async () => {
      const ids = [...selected]
      const res = await dismissDebutCandidatesBulk(ids)
      if (res.error) {
        toast.error(res.error)
        return
      }
      const done = new Set(ids)
      setRows((prev) => prev.filter((r) => !done.has(r.id)))
      setSelected(new Set())
      toast.success(`${res.dismissed ?? 0} dismissed`)
    })

  // Bulk create (retour Rudy 2026-08-20 : la sélection ne servait qu'à
  // Dismiss). Les échecs restent affichés (et pending côté serveur).
  const createSelected = () =>
    startTransition(async () => {
      const ids = [...selected]
      let res: Awaited<ReturnType<typeof approveDebutCandidatesBulk>>
      try {
        res = await approveDebutCandidatesBulk(ids)
      } catch {
        // Timeout d'invocation possible mi-lot : les créations déjà faites
        // sont en DB (resume-safe) — recharger pour voir l'état réel.
        toast.error('Interrompu (timeout ?) — recharge la page pour voir l’état réel')
        return
      }
      if (res.error) {
        toast.error(res.error)
        return
      }
      const failedNames = new Set((res.errors ?? []).map((e) => e.split(':')[0]))
      const chosen = new Set(ids)
      setRows((prev) =>
        prev.filter((r) => {
          if (!chosen.has(r.id)) return true
          const name = r.payload && 'name' in r.payload ? r.payload.name : r.page_title
          return failedNames.has(name)
        }),
      )
      setSelected(new Set())
      if ((res.errors ?? []).length > 0) toast.error(res.errors!.join(' · '))
      toast.success(`${res.created ?? 0} created — MVs en cours de récupération (arrière-plan)`)
    })

  const dismissStale = () =>
    startTransition(async () => {
      const res = await dismissStaleReviewQueues()
      if (res.error) {
        toast.error(res.error)
        return
      }
      // Agit sur TOUTE la DB (pas seulement la page) → un refresh serveur
      // recharge la liste ; ici on reflète localement les rows affichées.
      const cutoff = Date.now() - 30 * 86_400_000
      setRows((prev) =>
        prev.filter((r) => !(r.status === 'pending' && Date.parse(r.detected_at) < cutoff)),
      )
      toast.success(`${res.dismissed ?? 0} candidats + ${res.ignored ?? 0} lineups écartés (≥30 j)`)
    })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || selected.size === 0}
          onClick={createSelected}
          className="label-data-inline bg-primary text-primary-foreground cursor-pointer rounded-sm px-3 py-1.5 text-[9px] disabled:opacity-50"
        >
          Create selected ({selected.size})
        </button>
        <button
          type="button"
          disabled={pending || selected.size === 0}
          onClick={dismissSelected}
          className="label-data-inline bg-secondary text-muted-foreground hover:text-foreground cursor-pointer rounded-sm px-3 py-1.5 text-[9px] disabled:opacity-50"
        >
          Dismiss selected ({selected.size})
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={dismissStale}
          className="label-data-inline bg-secondary text-muted-foreground hover:text-foreground cursor-pointer rounded-sm px-3 py-1.5 text-[9px] disabled:opacity-50"
        >
          Auto-écarter ≥30 j (toute la file)
        </button>
        {pendingRows.length > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              setSelected((prev) =>
                prev.size === pendingRows.length
                  ? new Set()
                  : new Set(pendingRows.map((r) => r.id)),
              )
            }
            className="label-data-inline text-faint hover:text-foreground ml-auto cursor-pointer text-[9px]"
          >
            {selected.size === pendingRows.length ? 'Clear' : `Select all (${pendingRows.length})`}
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {rows.map((c) => {
          // Les rows auto-écartées portent un payload minimal {reason} — pas de
          // name/members. L'ancien accès direct crashait toute la page (2026-07-17).
          const payload = c.payload && 'name' in c.payload ? c.payload : null
          const reason = c.payload && 'reason' in c.payload ? c.payload.reason : null
          return (
            <li key={c.id}>
              <Panel className={cn(c.status === 'pending' && 'border-primary/40')}>
                <div className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {c.status === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                        aria-label={`Select ${c.page_title}`}
                        className="accent-primary size-3.5 cursor-pointer"
                      />
                    )}
                    <span className="label-data-inline bg-secondary rounded-sm px-1.5 py-0.5 text-[9px]">
                      {c.status}
                    </span>
                    {/* Tier de confiance du groupe créé (Phase 3 Lot 2, interne). */}
                    {c.group_confidence && (
                      <span
                        className={cn(
                          'label-data-inline rounded-sm px-1.5 py-0.5 text-[9px]',
                          c.group_confidence === 'candidate'
                            ? 'bg-amber/15 text-amber'
                            : 'bg-teal/15 text-teal',
                        )}
                      >
                        {c.group_confidence}
                      </span>
                    )}
                    <span className="text-xs font-semibold">{payload?.name ?? c.page_title}</span>
                    {payload?.debutDate && (
                      <span className="tabular text-primary text-[10px]">
                        debut {payload.debutDate}
                      </span>
                    )}
                    {payload?.label && (
                      <span className="text-muted-foreground text-[10px]">{payload.label}</span>
                    )}
                    <span className="tabular text-faint ml-auto text-[10px]">
                      {when(c.detected_at)}
                    </span>
                  </div>
                  {reason && (
                    <p className="text-muted-foreground text-xs">auto-dismissed: {reason}</p>
                  )}
                  {payload && (
                    <p className="text-muted-foreground text-xs">
                      {(payload.members ?? []).length > 0 && (
                        <>Members: {(payload.members ?? []).join(', ')} · </>
                      )}
                      {payload.wikipediaListed && 'Wikipedia ✓ · '}
                      {payload.ytVerified &&
                        `YT ${Intl.NumberFormat('en').format(payload.ytVerified.subs)} subs · `}
                      <a
                        href={payload.fandomUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        fandom
                      </a>
                    </p>
                  )}
                  {c.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => decide(c.id, 'create')}
                        className="label-data-inline bg-primary text-primary-foreground cursor-pointer rounded-sm px-3 py-1.5 text-[9px] disabled:opacity-50"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => decide(c.id, 'dismiss')}
                        className="label-data-inline bg-secondary text-muted-foreground hover:text-foreground cursor-pointer rounded-sm px-3 py-1.5 text-[9px] disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </Panel>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
