'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { CheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { followMany } from '@/lib/follows/actions'
import { cn } from '@/lib/utils'

type G = { id: string; name: string; image: string | null }

export function OnboardingGrid({ groups }: { groups: G[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function go(follow: boolean) {
    startTransition(async () => {
      if (follow && selected.size > 0) await followMany([...selected])
      router.push('/')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Welcome to KStage</h1>
        <p className="text-muted-foreground text-sm">
          Follow your groups · rate the comebacks · join the talk.
          <br />
          Pick a few to fill your calendar.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {groups.map((g) => {
          const on = selected.has(g.id)
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => toggle(g.id)}
              aria-pressed={on}
              className={cn(
                'group relative aspect-square overflow-hidden rounded-xl ring-1 transition',
                on ? 'ring-primary ring-2' : 'ring-foreground/10 hover:ring-foreground/25',
              )}
            >
              {g.image ? (
                <Image
                  src={g.image}
                  alt=""
                  fill
                  unoptimized
                  sizes="120px"
                  className="object-cover"
                />
              ) : (
                <div className="gradient-signature h-full w-full" aria-hidden />
              )}
              <span
                className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"
                aria-hidden
              />
              <span className="absolute inset-x-0 bottom-0 truncate p-1.5 text-xs font-medium text-white">
                {g.name}
              </span>
              {on && (
                <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full">
                  <CheckIcon className="size-3.5" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(false)}
          disabled={pending}
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          Skip for now
        </button>
        <Button type="button" onClick={() => go(true)} disabled={pending}>
          {pending
            ? 'Saving…'
            : selected.size > 0
              ? `Follow ${selected.size} & continue`
              : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
