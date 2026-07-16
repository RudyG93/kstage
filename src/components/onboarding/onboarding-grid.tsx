'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowRight, CheckIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { NotificationsOptIn } from '@/components/notifications/notifications-opt-in'
import { followMany } from '@/lib/follows/actions'
import { cn } from '@/lib/utils'
import { filterGroups, type OnboardingGroup } from './filter-groups'

export function OnboardingGrid({ groups }: { groups: OnboardingGroup[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<'grid' | 'notifications' | 'done'>('grid')
  const [query, setQuery] = useState('')
  const [pending, startTransition] = useTransition()

  // Sélection préservée hors du filtre courant (on peut chercher, cocher,
  // re-chercher) — le compteur reflète la sélection TOTALE.
  const shown = useMemo(() => filterGroups(groups, query), [groups, query])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exit(to: string = '/') {
    router.push(to)
    router.refresh()
  }

  function go(follow: boolean) {
    startTransition(async () => {
      if (follow && selected.size > 0) {
        try {
          await followMany([...selected])
        } catch {
          // Un throw non-catché dans startTransition remonte à l'error
          // boundary — écran d'erreur plein au moment le plus critique du
          // funnel (juste après signup). L'user garde sa sélection et réessaie.
          toast.error("Couldn't save your follows — please try again.")
          return
        }
        // Étape 2 : proposer le push maintenant que le calendrier a du contenu.
        // Skip / 0 follow → sortie directe (des notifs sans follows = vides).
        setStep('notifications')
        return
      }
      exit()
    })
  }

  // Étape finale « voir son calendrier » (audit §12 action 3) : n'existe que
  // sur le chemin avec follows — décision Rudy : la home reste la sortie
  // secondaire, /calendar devient le CTA explicite.
  if (step === 'done') {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-2">
          <span
            className="bg-teal/10 text-teal mx-auto flex size-12 items-center justify-center rounded-full"
            aria-hidden
          >
            <CheckIcon className="size-6" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Your calendar is ready</h1>
          <p className="text-muted-foreground text-sm">
            {selected.size} group{selected.size > 1 ? 's' : ''} followed — every comeback, MV and
            music show now shows up in your calendar.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Button type="button" onClick={() => exit('/calendar')}>
            See your calendar
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <button
            type="button"
            onClick={() => exit('/')}
            className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
          >
            Go to your home feed
          </button>
        </div>
      </div>
    )
  }

  if (step === 'notifications') return <NotificationsOptIn onDone={() => setStep('done')} />

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Welcome to KStage</h1>
        <p className="text-muted-foreground text-sm">
          Follow your groups · rate the comebacks · join the talk.
          <br />
          Pick at least 3 to fill your calendar.
        </p>
      </div>

      {/* Recherche sur TOUTE la liste (~140 groupes) — le top 30 par défaut ne
          suffit pas à « trouver SES trois artistes » (audit §12 action 3). */}
      <div className="relative">
        <SearchIcon
          className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your groups…"
          aria-label="Search groups"
          className="bg-secondary focus-visible:ring-ring/50 h-10 w-full rounded-lg border pl-9 text-base outline-none focus-visible:ring-2 sm:text-sm"
        />
      </div>

      {shown.length === 0 && (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No group matches “{query.trim()}” — try another spelling.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {shown.map((g) => {
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
        <div className="flex items-center gap-3">
          {/* Objectif visible « 3 pour un vrai calendrier » — jamais bloquant
              (1 follow vaut mieux qu'un abandon). */}
          <span
            className={cn(
              'tabular text-xs font-semibold',
              selected.size >= 3 ? 'text-teal' : 'text-muted-foreground',
            )}
            aria-live="polite"
          >
            {Math.min(selected.size, 3)}/3
          </span>
          <Button type="button" onClick={() => go(true)} disabled={pending}>
            {pending
              ? 'Saving…'
              : selected.size > 0
                ? `Follow ${selected.size} & continue`
                : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  )
}
