'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Slider } from '@base-ui/react/slider'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { rateEvent, deleteRating } from '@/lib/events/rating-actions'
import { cn } from '@/lib/utils'

const TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface Props {
  eventId: string
  slug: string
  initialScore: number | null
  avgScore: number | null
  count: number
  isAuthed: boolean
}

export function RatingSlider({ eventId, slug, initialScore, avgScore, count, isAuthed }: Props) {
  const [value, setValue] = useState<number>(initialScore ?? 5)
  const [rated, setRated] = useState<boolean>(initialScore !== null)
  const [pending, startTransition] = useTransition()

  const avgLabel = avgScore !== null ? avgScore.toFixed(1) : null
  const countLabel = count === 1 ? 'vote' : 'votes'

  function save(score: number) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('eventId', eventId)
      fd.set('slug', slug)
      fd.set('score', String(score))
      const res = await rateEvent(null, fd)
      if (res && 'error' in res) toast.error(res.error)
      else {
        setRated(true)
        toast.success('Rating saved')
      }
    })
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteRating(eventId, slug)
      if ('error' in res) toast.error(res.error)
      else {
        setRated(false)
        setValue(5)
        toast.success('Rating removed')
      }
    })
  }

  if (!isAuthed) {
    return (
      <p className="text-muted-foreground text-sm">
        <Link href="/login" className="text-primary underline-offset-2 hover:underline">
          Sign in
        </Link>{' '}
        to rate
        {avgLabel ? ` · Average: ${avgLabel}/10 (${count} ${countLabel})` : ''}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            'font-mono text-3xl font-bold tabular-nums',
            rated ? 'text-foreground' : 'text-muted-foreground/50',
          )}
        >
          {value.toFixed(1)}
        </span>
        <span className="text-muted-foreground text-xs">/ 10</span>
        {rated && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-muted-foreground hover:text-destructive ml-auto inline-flex items-center gap-1 text-xs"
          >
            <Trash2 className="size-3.5" aria-hidden />
            Remove
          </button>
        )}
      </div>

      <Slider.Root
        value={value}
        min={0}
        max={10}
        step={0.5}
        disabled={pending}
        onValueChange={(v) => setValue(Array.isArray(v) ? (v[0] ?? 0) : v)}
        onValueCommitted={(v) => save(Array.isArray(v) ? (v[0] ?? 0) : v)}
        aria-label="Your rating from 0 to 10"
      >
        <Slider.Control className="flex h-6 w-full items-center">
          <Slider.Track className="relative h-1.5 w-full rounded-full bg-[linear-gradient(90deg,#ef4444,#f59e0b,#22c55e)]">
            <Slider.Indicator className="rounded-full bg-transparent" />
            <Slider.Thumb className="focus-visible:ring-ring/60 size-5 rounded-full border-2 border-white bg-white shadow ring-offset-2 outline-none focus-visible:ring-2" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>

      <div className="text-muted-foreground flex justify-between px-0.5 font-mono text-[10px] tabular-nums">
        {TICKS.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>

      <p className="text-muted-foreground text-sm">
        {rated ? 'Drag to update your rating.' : 'Drag the slider to rate.'}
        {avgLabel ? ` · Average: ${avgLabel}/10 (${count} ${countLabel})` : ''}
      </p>
    </div>
  )
}
