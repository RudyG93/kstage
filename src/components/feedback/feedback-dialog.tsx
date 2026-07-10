'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquarePlus } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { submitFeedback, type FeedbackState } from '@/lib/feedback/actions'
import { cn } from '@/lib/utils'

const BODY_MAX = 500

/**
 * Widget Feedback léger (bug / idée) : bouton discret → mini-formulaire.
 * Anti-spam côté serveur (auth requise, 2/24h, longueur bornée + CHECK DB).
 */
export function FeedbackDialog({ triggerClassName }: { triggerClassName?: string }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'bug' | 'idea'>('idea')
  const [chars, setChars] = useState(0)
  const pathname = usePathname()
  const formRef = useRef<HTMLFormElement>(null)
  const lastHandled = useRef<FeedbackState>(null)
  const [state, formAction, pending] = useActionState<FeedbackState, FormData>(submitFeedback, null)

  useEffect(() => {
    if (state && state !== lastHandled.current && 'ok' in state && state.ok) {
      lastHandled.current = state
      formRef.current?.reset()
      setChars(0)
      setOpen(false)
      toast.success('Thanks for the feedback!')
    }
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          'label-data-inline text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1.5 text-[9px] transition-colors outline-none focus-visible:ring-2'
        }
      >
        <MessageSquarePlus className="size-3.5" aria-hidden />
        Feedback
      </button>

      <DialogContent>
        <DialogTitle>Send feedback</DialogTitle>
        <form ref={formRef} action={formAction} className="mt-3 space-y-3">
          <input type="hidden" name="page" value={pathname} />
          <input type="hidden" name="kind" value={kind} />
          <div className="flex gap-1.5" role="radiogroup" aria-label="Feedback type">
            {(['idea', 'bug'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  'label-data-inline cursor-pointer rounded-sm px-3 py-1.5 text-[9px] transition-colors',
                  kind === k
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {k === 'idea' ? '💡 Idea' : '🐛 Bug'}
              </button>
            ))}
          </div>
          <textarea
            name="body"
            required
            rows={4}
            maxLength={BODY_MAX + 50}
            onChange={(e) => setChars(e.target.value.length)}
            placeholder={
              kind === 'bug'
                ? 'What went wrong? Where, and what did you expect?'
                : 'What would make KStage better for you?'
            }
            className="bg-secondary focus-visible:ring-primary/50 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
          />
          <div className="flex items-center justify-between text-xs">
            <span
              className={cn(
                'tabular text-muted-foreground',
                chars > BODY_MAX && 'text-destructive',
              )}
              aria-live="polite"
            >
              {chars}/{BODY_MAX}
            </span>
            <button
              type="submit"
              disabled={pending || chars < 10 || chars > BODY_MAX}
              className="label-data-inline bg-primary text-primary-foreground focus-visible:ring-ring/50 rounded-sm px-3.5 py-2 text-[9px] outline-none focus-visible:ring-2 disabled:opacity-50"
            >
              {pending ? 'Sending…' : 'Send'}
            </button>
          </div>
          {state && 'error' in state && (
            <p className="text-destructive text-xs" role="alert">
              {state.error}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
