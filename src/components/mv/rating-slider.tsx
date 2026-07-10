'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Slider } from '@base-ui/react/slider'
import { toast } from 'sonner'
import { rateEvent } from '@/lib/events/rating-actions'
import { cn } from '@/lib/utils'

interface Props {
  eventId: string
  slug: string
  initialScore: number | null
  isAuthed: boolean
}

/**
 * YOUR RATING (§7.7.3) : slider 0-10 pas 0.5 — track 6px, fill gradient
 * primary→teal, thumb 16px — + bouton SAVE explicite (fini le save-on-release).
 */
export function RatingSlider({ eventId, slug, initialScore, isAuthed }: Props) {
  const [value, setValue] = useState<number>(initialScore ?? 5)
  const [savedScore, setSavedScore] = useState<number | null>(initialScore)
  // Sans note initiale, le 5.0 par défaut n'est PAS une intention : Save reste
  // désactivé tant que l'user n'a pas touché le slider (audit 2026-07-04).
  const [touched, setTouched] = useState(false)
  const [pending, startTransition] = useTransition()
  const dirty = (touched || savedScore !== null) && value !== savedScore

  function save() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('eventId', eventId)
      fd.set('slug', slug)
      fd.set('score', String(value))
      const res = await rateEvent(null, fd)
      if (res && 'error' in res) toast.error(res.error)
      else {
        setSavedScore(value)
        toast.success('Rating saved')
      }
    })
  }

  if (!isAuthed) {
    return (
      <p className="text-muted-foreground text-sm">
        <Link href="/login" className="text-primary underline-offset-2 hover:underline">
          Sign in
        </Link>{' '}
        to rate this drop.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="label-data">Your rating</span>
        <span
          className={cn(
            'tabular text-base font-bold',
            savedScore !== null || dirty ? 'text-primary' : 'text-muted-foreground/50',
          )}
        >
          {value.toFixed(1)}
        </span>
      </div>

      <Slider.Root
        value={value}
        min={0}
        max={10}
        step={0.5}
        disabled={pending}
        onValueChange={(v) => {
          setTouched(true)
          setValue(Array.isArray(v) ? (v[0] ?? 0) : v)
        }}
        aria-label="Your rating from 0 to 10"
      >
        <Slider.Control className="flex h-6 w-full items-center">
          <Slider.Track className="bg-foreground/9 relative h-[6px] w-full rounded-full">
            <Slider.Indicator className="gradient-signature rounded-full" />
            <Slider.Thumb className="bg-foreground focus-visible:ring-ring/60 size-4 rounded-full shadow-[0_2px_8px_rgba(0,0,0,.5)] outline-none focus-visible:ring-2" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>

      <div className="flex items-center justify-between">
        <span className="tabular text-muted-foreground text-[10px]">0 — 10 · step 0.5</span>
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="label-data-inline bg-primary text-primary-foreground focus-visible:ring-ring/50 rounded-sm px-3 py-1.5 text-[9px] transition-opacity outline-none focus-visible:ring-2 disabled:opacity-40"
        >
          {pending ? 'Saving…' : savedScore !== null && !dirty ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}
