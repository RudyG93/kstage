'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { submitSuggestion, type SuggestionState } from '@/lib/suggestions/actions'
import type { TargetableEvent } from '@/lib/suggestions/queries'

const inputClass =
  'h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

interface FetchState {
  loading: boolean
  events: TargetableEvent[]
  error: string | null
}

function formatEventOption(event: TargetableEvent): string {
  const date = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(new Date(event.start_at))
  const groupName = event.groups?.name ?? '?'
  return `${groupName} — ${event.title} · ${date}`
}

export function SuggestFixForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, formAction, pending] = useActionState<SuggestionState, FormData>(
    submitSuggestion,
    null,
  )
  const [fetchState, setFetchState] = useState<FetchState>({
    loading: true,
    events: [],
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    fetch('/api/suggestions/targetable-events')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ events: TargetableEvent[] }>
      })
      .then((data) => {
        if (cancelled) return
        setFetchState({ loading: false, events: data.events ?? [], error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setFetchState({
          loading: false,
          events: [],
          error: err instanceof Error ? err.message : 'Could not load events',
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const ok = state !== null && 'ok' in state

  useEffect(() => {
    if (ok) {
      toast.success('Fix sent — a moderator will review it.')
      onSuccess?.()
    }
  }, [ok, onSuccess])

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="kind" value="fix" />

      <div className="space-y-1.5">
        <label htmlFor="targetEventId" className="text-sm font-medium">
          Event to fix
        </label>
        {fetchState.loading ? (
          <p className="text-muted-foreground text-sm">Loading events…</p>
        ) : fetchState.error ? (
          <p role="alert" className="text-destructive text-sm">
            {fetchState.error}
          </p>
        ) : (
          <select
            id="targetEventId"
            name="targetEventId"
            required
            className={inputClass}
            defaultValue=""
          >
            <option value="" disabled>
              Choose an event…
            </option>
            {fetchState.events.map((event) => (
              <option key={event.id} value={event.id}>
                {formatEventOption(event)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          What is incorrect?
        </label>
        <textarea
          id="description"
          name="description"
          required
          maxLength={500}
          rows={4}
          placeholder="Wrong date, wrong title, broken link, missing info…"
          className="bg-background focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="sourceUrl" className="text-sm font-medium">
          Source URL <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          id="sourceUrl"
          name="sourceUrl"
          type="url"
          placeholder="https://…"
          className={inputClass}
        />
      </div>

      {state !== null && 'error' in state && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending || fetchState.loading} className="w-full">
        {pending ? 'Submitting…' : 'Submit fix'}
      </Button>
    </form>
  )
}
