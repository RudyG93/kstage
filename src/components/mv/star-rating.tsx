'use client'

import { useState, useTransition, useOptimistic } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { rateEvent } from '@/lib/events/rating-actions'

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

interface Props {
  eventId: string
  slug: string
  initialScore: number | null
  avgScore: number | null
  count: number
  isAuthed: boolean
}

export function StarRating({ eventId, slug, initialScore, avgScore, count, isAuthed }: Props) {
  const [, startTransition] = useTransition()
  const [hover, setHover] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useOptimistic<number | null, number>(
    initialScore,
    (_prev, next) => next,
  )

  // Affichage : hover prend le pas s'il existe, sinon l'optimistic (committed).
  const display = hover ?? optimistic ?? 0

  function submit(score: number) {
    if (!isAuthed) return
    startTransition(async () => {
      setOptimistic(score)
      setError(null)
      const fd = new FormData()
      fd.set('eventId', eventId)
      fd.set('slug', slug)
      fd.set('score', String(score))
      const res = await rateEvent(null, fd)
      if (res && 'error' in res) setError(res.error)
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, score: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(10, score + 1)
      const target =
        e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[next - 1]
      target?.focus()
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      const prev = Math.max(1, score - 1)
      const target =
        e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[prev - 1]
      target?.focus()
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      submit(score)
    }
  }

  const avgLabel = avgScore !== null ? avgScore.toFixed(1) : null
  const countLabel = count === 1 ? 'vote' : 'votes'

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        tabIndex={-1}
        aria-label="Rate this MV from 1 to 10"
        onMouseLeave={() => setHover(null)}
        className={cn(
          'flex items-center gap-0.5 focus:outline-none',
          !isAuthed && 'pointer-events-none opacity-90',
        )}
      >
        {SCORES.map((i) => {
          const filled = i <= display
          // Le tabindex roving : seule la note actuelle (ou 1 si pas de note) est focusable au Tab.
          const focusableScore = optimistic ?? 1
          const tabIndex = i === focusableScore ? 0 : -1
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={optimistic === i}
              aria-label={optimistic === i ? `Rated ${i}/10` : `Rate ${i}/10`}
              tabIndex={isAuthed ? tabIndex : -1}
              disabled={!isAuthed}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={(e) => {
                // Ne reset que si le focus quitte vraiment le radiogroup (évite
                // le flicker en navigation clavier ←/→ entre étoiles).
                if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
                  setHover(null)
                }
              }}
              onClick={() => submit(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'rounded-md p-0.5 transition-transform focus:outline-none',
                'focus-visible:ring-primary/60 focus-visible:ring-2 focus-visible:ring-offset-2',
                'focus-visible:ring-offset-background',
                isAuthed && 'hover:scale-110',
              )}
            >
              <Star
                className={cn(
                  'size-7 transition-colors',
                  filled
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-muted-foreground/60 fill-transparent',
                )}
                strokeWidth={1.5}
                aria-hidden
              />
            </button>
          )
        })}
      </div>

      <div
        className="text-muted-foreground min-h-[1.25rem] text-sm"
        aria-live="polite"
        aria-atomic="true"
      >
        {!isAuthed ? (
          <span>
            <Link href="/login" className="text-primary underline-offset-2 hover:underline">
              Sign in
            </Link>{' '}
            to rate
            {avgLabel ? ` · Average: ${avgLabel}/10 (${count} ${countLabel})` : ''}
          </span>
        ) : optimistic ? (
          <span>
            Your rating: <span className="text-foreground font-semibold">{optimistic}/10</span>
            {avgLabel ? ` · Average: ${avgLabel}/10 (${count} ${countLabel})` : ''}
          </span>
        ) : (
          <span>
            {avgLabel
              ? `Average: ${avgLabel}/10 (${count} ${countLabel}) · click a star to rate`
              : 'No ratings yet · be the first to rate'}
          </span>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}
