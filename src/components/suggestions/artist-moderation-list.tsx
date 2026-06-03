'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { approveArtistSuggestion, rejectArtistSuggestion } from '@/lib/suggestions/actions'
import type { PendingArtistSuggestion } from '@/lib/suggestions/queries'

type ModAction = (id: string) => Promise<{ error: string } | { ok: true }>

export function ArtistModerationList({ suggestions }: { suggestions: PendingArtistSuggestion[] }) {
  if (suggestions.length === 0) {
    return <p className="text-muted-foreground text-sm">No pending artist suggestions.</p>
  }
  return (
    <ul className="space-y-3">
      {suggestions.map((s) => (
        <ArtistModerationItem key={s.id} suggestion={s} />
      ))}
    </ul>
  )
}

function ArtistModerationItem({ suggestion }: { suggestion: PendingArtistSuggestion }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: ModAction) {
    setError(null)
    startTransition(async () => {
      const res = await action(suggestion.id)
      if ('error' in res) setError(res.error)
    })
  }

  const members = (Array.isArray(suggestion.members) ? suggestion.members : []) as Array<{
    name?: string
    position?: string | null
  }>

  return (
    <li className="space-y-2 rounded-lg border p-3">
      <div className="space-y-0.5">
        <p className="font-medium">
          {suggestion.name}{' '}
          <span className="text-muted-foreground text-xs">· {suggestion.kind}</span>
        </p>
        <p className="text-muted-foreground text-xs">
          {[suggestion.agency, suggestion.debut_date, suggestion.fandom_name]
            .filter(Boolean)
            .join(' · ') || '—'}
        </p>
        {members.length > 0 && (
          <p className="text-muted-foreground text-xs">
            {members
              .map((m) => (m.position ? `${m.name} (${m.position})` : m.name))
              .filter(Boolean)
              .join(', ')}
          </p>
        )}
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
        <Button size="sm" disabled={pending} onClick={() => run(approveArtistSuggestion)}>
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => run(rejectArtistSuggestion)}
        >
          Reject
        </Button>
      </div>
    </li>
  )
}
