'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { submitSuggestion, type SuggestionState } from '@/lib/suggestions/actions'
import { SUGGESTABLE_TYPES } from '@/lib/suggestions/validation'
import { EVENT_TYPE_LABELS } from '@/lib/events/labels'

const inputClass =
  'h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

export function SuggestionForm({ groups }: { groups: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<SuggestionState, FormData>(
    submitSuggestion,
    null,
  )
  const ok = state !== null && 'ok' in state

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="groupId" className="text-sm font-medium">
          Group
        </label>
        <select id="groupId" name="groupId" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Choose a group…
          </option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="type" className="text-sm font-medium">
          Event type
        </label>
        <select id="type" name="type" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Choose a type…
          </option>
          {SUGGESTABLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={120}
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="startAt" className="text-sm font-medium">
          Date &amp; time <span className="text-muted-foreground">(KST)</span>
        </label>
        <input
          id="startAt"
          name="startAt"
          type="datetime-local"
          step={300}
          required
          className={inputClass}
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
      {ok && (
        <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
          Thanks! Your suggestion was submitted and is awaiting review.
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Submitting…' : 'Submit suggestion'}
      </Button>
    </form>
  )
}
