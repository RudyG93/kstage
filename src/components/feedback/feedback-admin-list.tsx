'use client'

import { useOptimistic, useTransition } from 'react'
import { markFeedbackRead, type FeedbackRow } from '@/lib/feedback/actions'
import { Panel } from '@/components/ui/panel'
import { cn } from '@/lib/utils'

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )

export function FeedbackAdminList({ items }: { items: FeedbackRow[] }) {
  const [optimistic, markRead] = useOptimistic(items, (prev, id: string) =>
    prev.map((f) => (f.id === id ? { ...f, status: 'read' } : f)),
  )
  const [, startTransition] = useTransition()

  if (optimistic.length === 0) {
    return <p className="text-muted-foreground text-sm">No feedback yet.</p>
  }

  return (
    <ul className="space-y-2">
      {optimistic.map((f) => (
        <li key={f.id}>
          <Panel className={cn(f.status === 'new' && 'border-primary/40')}>
            <div className="space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="label-data-inline bg-secondary rounded-sm px-1.5 py-0.5 text-[9px]">
                  {f.kind === 'bug' ? '🐛 Bug' : f.kind === 'data' ? '📊 Data' : '💡 Idea'}
                </span>
                <span className="text-xs font-semibold">{f.username ?? 'unknown'}</span>
                {f.page && <span className="tabular text-faint text-[10px]">{f.page}</span>}
                <span className="tabular text-faint ml-auto text-[10px]">{when(f.created_at)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{f.body}</p>
              {f.status === 'new' && (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      markRead(f.id)
                      await markFeedbackRead(f.id)
                    })
                  }
                  className="label-data-inline text-primary hover:text-primary/80 cursor-pointer text-[9px]"
                >
                  Mark as read
                </button>
              )}
            </div>
          </Panel>
        </li>
      ))}
    </ul>
  )
}
