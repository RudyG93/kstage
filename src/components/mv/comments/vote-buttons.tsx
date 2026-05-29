'use client'

import { useOptimistic, useTransition } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { voteComment } from '@/lib/comments/actions'

interface Props {
  commentId: string
  slug: string
  initialScore: number
  initialUserVote: -1 | 1 | null
  isAuthed: boolean
}

type OptimisticState = { score: number; userVote: -1 | 1 | null }

/**
 * Boutons up/down +/- avec optimistic UI (pattern StarRating:24-44).
 * Click sur la même valeur que le vote actuel → toggle (annule).
 * Click sur l'opposé → swap (+2 ou -2 sur le score).
 */
export function VoteButtons({ commentId, slug, initialScore, initialUserVote, isAuthed }: Props) {
  const [, startTransition] = useTransition()
  const [opt, setOpt] = useOptimistic<OptimisticState, -1 | 1>(
    { score: initialScore, userVote: initialUserVote },
    (prev, target) => {
      // Toggle ?
      if (prev.userVote === target) {
        return { score: prev.score - target, userVote: null }
      }
      // Swap ou nouveau vote
      const delta = prev.userVote === null ? target : target - prev.userVote
      return { score: prev.score + delta, userVote: target }
    },
  )

  function submit(value: -1 | 1) {
    if (!isAuthed) return
    startTransition(async () => {
      setOpt(value)
      const fd = new FormData()
      fd.set('commentId', commentId)
      fd.set('slug', slug)
      fd.set('value', String(value))
      await voteComment(null, fd)
    })
  }

  return (
    <div
      className="text-muted-foreground flex items-center gap-0.5 text-xs"
      aria-label={`Score ${opt.score}`}
    >
      <button
        type="button"
        onClick={() => submit(1)}
        disabled={!isAuthed}
        aria-pressed={opt.userVote === 1}
        aria-label="Upvote"
        className={cn(
          'focus-visible:ring-primary/50 rounded p-1 outline-none focus-visible:ring-2',
          opt.userVote === 1 ? 'text-primary' : 'hover:text-foreground',
          !isAuthed && 'cursor-not-allowed opacity-60',
        )}
      >
        <ArrowUp className="size-3.5" strokeWidth={2} aria-hidden />
      </button>
      <span
        className={cn(
          'min-w-[1.25rem] text-center font-mono tabular-nums',
          opt.userVote === 1 && 'text-primary',
          opt.userVote === -1 && 'text-destructive',
        )}
        aria-live="polite"
        aria-atomic="true"
      >
        {opt.score}
      </span>
      <button
        type="button"
        onClick={() => submit(-1)}
        disabled={!isAuthed}
        aria-pressed={opt.userVote === -1}
        aria-label="Downvote"
        className={cn(
          'focus-visible:ring-primary/50 rounded p-1 outline-none focus-visible:ring-2',
          opt.userVote === -1 ? 'text-destructive' : 'hover:text-foreground',
          !isAuthed && 'cursor-not-allowed opacity-60',
        )}
      >
        <ArrowDown className="size-3.5" strokeWidth={2} aria-hidden />
      </button>
    </div>
  )
}
