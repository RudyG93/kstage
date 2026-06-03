'use client'

import { useActionState, useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { submitArtistSuggestion, type SuggestionState } from '@/lib/suggestions/actions'
import { MAX_MEMBERS } from '@/lib/suggestions/artist-validation'

const inputClass =
  'h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

type Member = { name: string; position: string }

export function SuggestArtistForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, formAction, pending] = useActionState<SuggestionState, FormData>(
    submitArtistSuggestion,
    null,
  )
  const [kind, setKind] = useState<'group' | 'solo'>('group')
  const [members, setMembers] = useState<Member[]>([])

  const ok = state !== null && 'ok' in state
  useEffect(() => {
    if (ok) {
      toast.success('Artist suggestion sent — a moderator will review it.')
      onSuccess?.()
    }
  }, [ok, onSuccess])

  const membersJson = JSON.stringify(members.filter((m) => m.name.trim()))

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="members" value={membersJson} />

      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input id="name" name="name" required maxLength={80} className={inputClass} />
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">Type</span>
        <ToggleGroup
          aria-label="Artist type"
          value={[kind]}
          onValueChange={(values) => {
            const next = values[0]
            if (next === 'group' || next === 'solo') setKind(next)
          }}
        >
          <ToggleGroupItem value="group">Group</ToggleGroupItem>
          <ToggleGroupItem value="solo">Solo</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="agency" className="text-sm font-medium">
            Agency <span className="text-muted-foreground">(optional)</span>
          </label>
          <input id="agency" name="agency" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="debutDate" className="text-sm font-medium">
            Debut date <span className="text-muted-foreground">(optional)</span>
          </label>
          <input id="debutDate" name="debutDate" type="date" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="fandomName" className="text-sm font-medium">
            Fandom <span className="text-muted-foreground">(optional)</span>
          </label>
          <input id="fandomName" name="fandomName" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="colorHex" className="text-sm font-medium">
            Color <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            id="colorHex"
            name="colorHex"
            type="text"
            placeholder="#1abc9c"
            pattern="#[0-9a-fA-F]{6}"
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="imageUrl" className="text-sm font-medium">
          Image URL <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          id="imageUrl"
          name="imageUrl"
          type="url"
          placeholder="https://…"
          className={inputClass}
        />
      </div>

      {kind === 'group' && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Members</span>
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                aria-label={`Member ${i + 1} name`}
                value={m.name}
                onChange={(e) =>
                  setMembers((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                  )
                }
                placeholder="Stage name"
                className={inputClass}
              />
              <input
                aria-label={`Member ${i + 1} position`}
                value={m.position}
                onChange={(e) =>
                  setMembers((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, position: e.target.value } : x)),
                  )
                }
                placeholder="Position"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setMembers((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Remove member"
                className="text-muted-foreground hover:text-destructive shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          {members.length < MAX_MEMBERS && (
            <button
              type="button"
              onClick={() => setMembers((prev) => [...prev, { name: '', position: '' }])}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
            >
              <Plus className="size-4" /> Add member
            </button>
          )}
        </div>
      )}

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

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Submitting…' : 'Submit artist'}
      </Button>
    </form>
  )
}
