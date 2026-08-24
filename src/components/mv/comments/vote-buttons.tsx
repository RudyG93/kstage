'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { voteComment } from '@/lib/comments/actions'

interface Props {
  commentId: string
  slug?: string
  /** Chemin /show/... à revalider (commentaires d'épisode, Lot N). */
  path?: string
  initialScore: number
  initialUserVote: -1 | 1 | null
  isAuthed: boolean
  /** Le viewer est l'auteur : score affiche, fleches retirees. */
  isOwn?: boolean
}

type OptimisticState = { score: number; userVote: -1 | 1 | null }

/**
 * Boutons up/down +/- avec optimistic UI (pattern StarRating:24-44).
 * Click sur la même valeur que le vote actuel → toggle (annule).
 * Click sur l'opposé → swap (+2 ou -2 sur le score).
 */
export function VoteButtons({
  commentId,
  slug = '',
  path = '',
  initialScore,
  initialUserVote,
  isAuthed,
  isOwn = false,
}: Props) {
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

  const [erreur, setErreur] = useState<string | null>(null)

  function submit(value: -1 | 1) {
    if (!isAuthed || isOwn) return
    startTransition(async () => {
      setOpt(value)
      const fd = new FormData()
      fd.set('commentId', commentId)
      fd.set('slug', slug)
      fd.set('path', path)
      fd.set('value', String(value))
      const res = await voteComment(null, fd)
      // Un vote refusé revenait en silence : le chiffre sautait à sa valeur
      // d'origine sans un mot, et l'utilisateur croyait à un bug d'affichage.
      setErreur(res && 'error' in res ? res.error : null)
    })
  }

  // Son propre commentaire : le score reste lisible, les fleches disparaissent
  // — proposer une action que la base refuse ne rend service a personne.
  if (isOwn) {
    return (
      <span className="text-muted-foreground tabular text-xs" aria-label={`Score ${opt.score}`}>
        {opt.score}
      </span>
    )
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
          'focus-visible:ring-primary/50 flex min-h-6 min-w-6 items-center justify-center rounded outline-none focus-visible:ring-2',
          opt.userVote === 1 ? 'text-teal' : 'hover:text-foreground',
          !isAuthed && 'cursor-not-allowed opacity-60',
        )}
      >
        <ArrowUp className="size-3.5" strokeWidth={2} aria-hidden />
      </button>
      <span
        className={cn(
          'tabular min-w-[1.25rem] text-center',
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
          'focus-visible:ring-primary/50 flex min-h-6 min-w-6 items-center justify-center rounded outline-none focus-visible:ring-2',
          opt.userVote === -1 ? 'text-destructive' : 'hover:text-foreground',
          !isAuthed && 'cursor-not-allowed opacity-60',
        )}
      >
        <ArrowDown className="size-3.5" strokeWidth={2} aria-hidden />
      </button>
      {erreur && (
        <span role="alert" className="text-destructive ml-1 text-[11px]">
          {erreur}
        </span>
      )}
    </div>
  )
}
