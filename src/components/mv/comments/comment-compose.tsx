'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { postComment, type CommentState } from '@/lib/comments/actions'
import { BODY_MAX } from '@/lib/comments/validation'
import { cn } from '@/lib/utils'

interface Props {
  /** Cible MV (event). Exactement une des deux cibles avec episodeId. */
  eventId?: string
  /** Cible épisode de music show (Lot N 2026-07-17). */
  episodeId?: string
  /** Slug MV pour la revalidation /mv/[slug] (cible event). */
  slug?: string
  /** Chemin /show/... à revalider (cible épisode). */
  path?: string
  parentId?: string | null
  /** Focus le textarea au mount via ref (pas via prop autoFocus, qui a11y-warn). */
  focusOnMount?: boolean
  onCancel?: () => void
  placeholder?: string
}

/**
 * Compose un nouveau commentaire (root si parentId vide, sinon reply).
 * `onCancel` rendu en bouton si fourni (utilisé pour fermer le reply form inline).
 *
 * Reset auto du textarea après succès. Compteur de chars en aria-live.
 */
export function CommentCompose({
  eventId = '',
  episodeId = '',
  slug = '',
  path = '',
  parentId,
  focusOnMount,
  onCancel,
  placeholder = 'Share your thoughts…',
}: Props) {
  const [state, formAction, pending] = useActionState<CommentState, FormData>(postComment, null)
  const formRef = useRef<HTMLFormElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [chars, setChars] = useState(0)
  const lastHandledState = useRef<CommentState>(null)

  // Post-submit reset : on déclenche depuis l'effet seulement quand le `state`
  // change vers un nouveau succès, et on guard avec un ref pour ne pas re-fire
  // sur les renders suivants. `react-hooks/set-state-in-effect` lint accepte
  // ce pattern guard-once.
  useEffect(() => {
    if (state && state !== lastHandledState.current && 'ok' in state && state.ok) {
      lastHandledState.current = state
      formRef.current?.reset()
      setChars(0)
      onCancel?.()
    }
  }, [state, onCancel])

  useEffect(() => {
    if (focusOnMount) taRef.current?.focus()
  }, [focusOnMount])

  const tooLong = chars > BODY_MAX
  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="episodeId" value={episodeId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="path" value={path} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <textarea
        ref={taRef}
        name="body"
        required
        rows={3}
        maxLength={BODY_MAX + 100}
        placeholder={placeholder}
        onChange={(e) => setChars(e.target.value.length)}
        className={cn(
          'border-border bg-background focus-visible:ring-primary/50 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2',
          tooLong && 'border-destructive',
        )}
      />
      <div className="flex items-center justify-between gap-3 text-xs">
        <span
          aria-live="polite"
          aria-atomic="true"
          className={cn('text-muted-foreground tabular-nums', tooLong && 'text-destructive')}
        >
          {chars}/{BODY_MAX}
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="hover:text-foreground text-muted-foreground rounded-md px-2 py-1"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={pending || chars === 0 || tooLong}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/50 rounded-md px-3 py-1 font-medium outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Posting…' : parentId ? 'Reply' : 'Post'}
          </button>
        </div>
      </div>
      {state && 'error' in state && (
        <p className="text-destructive text-xs" role="alert">
          {state.error}
        </p>
      )}
    </form>
  )
}
