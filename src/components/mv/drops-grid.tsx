'use client'

import { useMemo, useState } from 'react'
import { MvCard } from '@/components/group/mv-card'
import { cn } from '@/lib/utils'
import type { MvEvent } from '@/lib/events/queries'

// Grille Latest drops CONTRÔLÉE (R5) : les pills All|Following et new|top
// étaient des <Link> ?feed=&sort= → chaque clic re-rendait la page côté
// serveur (« ça ralentit », retour Rudy). Les deux jeux de données arrivent
// du serveur, le filtre/tri se fait en mémoire.
export interface DropsRating {
  avg: number
  count: number
}

export function DropsGrid({
  all,
  following,
  ratings,
  hasFollows,
  initialFeed,
  initialSort,
}: {
  all: MvEvent[]
  following: MvEvent[]
  ratings: Record<string, DropsRating>
  hasFollows: boolean
  initialFeed: 'all' | 'following'
  initialSort: 'new' | 'top'
}) {
  const [feed, setFeed] = useState(initialFeed)
  const [sort, setSort] = useState(initialSort)

  const grid = useMemo(() => {
    const source = feed === 'following' ? following : all
    if (sort === 'new') return source
    return [...source].sort((a, b) => (ratings[b.id]?.avg ?? -1) - (ratings[a.id]?.avg ?? -1))
  }, [all, following, ratings, feed, sort])

  const pill = (active: boolean) =>
    cn(
      'label-data-inline cursor-pointer rounded-sm px-2 py-1 text-[9px] transition-colors',
      active
        ? 'bg-foreground text-background'
        : 'bg-secondary text-muted-foreground hover:text-foreground',
    )

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="label-data">Latest drops</span>
          {hasFollows && (
            <div
              className="ml-2 flex items-center gap-1"
              role="radiogroup"
              aria-label="Feed filter"
            >
              {(['all', 'following'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={feed === f}
                  onClick={() => setFeed(f)}
                  className={pill(feed === f)}
                >
                  {f === 'all' ? 'All' : 'Following'}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Sort drops">
          <span className="label-data-inline text-faint text-[9px]">Sort:</span>
          {(['new', 'top'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sort === s}
              onClick={() => setSort(s)}
              className={pill(sort === s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      {grid.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {feed === 'following'
            ? 'No music videos from your groups yet.'
            : 'No music videos tracked yet.'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-[9px] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {grid.map((mv) => (
            <li key={mv.id}>
              <MvCard mv={mv} rating={ratings[mv.id]} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
