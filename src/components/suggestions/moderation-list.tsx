'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { approveSuggestion, rejectSuggestion } from '@/lib/suggestions/actions'
import { formatEventDate } from '@/lib/events/date'
import type { PendingSuggestion } from '@/lib/suggestions/queries'

type ModAction = (id: string) => Promise<{ error: string } | { ok: true }>

export function ModerationList({ suggestions }: { suggestions: PendingSuggestion[] }) {
  if (suggestions.length === 0) {
    return <p className="text-muted-foreground text-sm">No pending suggestions.</p>
  }
  return (
    <ul className="space-y-3">
      {suggestions.map((s) => (
        <ModerationItem key={s.id} suggestion={s} />
      ))}
    </ul>
  )
}

function ModerationItem({ suggestion }: { suggestion: PendingSuggestion }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: ModAction) {
    setError(null)
    startTransition(async () => {
      const res = await action(suggestion.id)
      if ('error' in res) setError(res.error)
    })
  }

  return (
    <li className="space-y-2 rounded-lg border p-3">
      <div className="space-y-0.5">
        <p className="font-medium">{suggestion.title}</p>
        <p className="text-muted-foreground text-xs">
          {suggestion.groups?.name} · {suggestion.type} ·{' '}
          {formatEventDate(suggestion.start_at, 'Asia/Seoul')} KST
        </p>
        {suggestion.source_url && (
          <a
            href={suggestion.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
          >
            source
          </a>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => run(approveSuggestion)}>
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => run(rejectSuggestion)}
        >
          Reject
        </Button>
      </div>
    </li>
  )
}
