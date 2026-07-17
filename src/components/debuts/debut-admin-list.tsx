'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Panel } from '@/components/ui/panel'
import {
  approveDebutCandidate,
  dismissDebutCandidate,
  type DebutCandidateRow,
} from '@/lib/debuts/actions'
import { cn } from '@/lib/utils'

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso))

export function DebutAdminList({ items }: { items: DebutCandidateRow[] }) {
  const [rows, setRows] = useState(items)
  const [pending, startTransition] = useTransition()

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
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: action === 'create' ? 'created' : 'dismissed' } : r,
        ),
      )
      toast.success(action === 'create' ? 'Group created' : 'Dismissed')
    })

  return (
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
  )
}
