'use client'

import { useMemo, useState } from 'react'
import { MvCard } from '@/components/group/mv-card'
import { cn } from '@/lib/utils'
import type { MvEvent } from '@/lib/events/queries'
import { loadMoreDrops } from '@/lib/events/drops-actions'

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
  initialCursor,
  timeZone,
}: {
  all: MvEvent[]
  following: MvEvent[]
  ratings: Record<string, DropsRating>
  hasFollows: boolean
  initialFeed: 'all' | 'following'
  initialSort: 'new' | 'top'
  /** Curseur de la page suivante, null quand le catalogue est épuisé. */
  initialCursor: string | null
  timeZone: string
}) {
  const [feed, setFeed] = useState(initialFeed)
  const [sort, setSort] = useState(initialSort)
  // Pages chargées à la demande : la grille servait 30 clips sur 3 173 sans
  // aucun moyen d'aller plus loin.
  const [extra, setExtra] = useState<MvEvent[]>([])
  const [extraRatings, setExtraRatings] = useState<Record<string, DropsRating>>({})
  const [cursor, setCursor] = useState(initialCursor)
  const [loading, setLoading] = useState(false)

  const allRatings = useMemo(() => ({ ...ratings, ...extraRatings }), [ratings, extraRatings])

  const grid = useMemo(() => {
    const source = feed === 'following' ? following : [...all, ...extra]
    if (sort === 'new') return source
    return [...source].sort((a, b) => (allRatings[b.id]?.avg ?? -1) - (allRatings[a.id]?.avg ?? -1))
  }, [all, extra, following, allRatings, feed, sort])

  async function onLoadMore() {
    if (!cursor || loading) return
    setLoading(true)
    try {
      const page = await loadMoreDrops(cursor)
      setExtra((prev) => [...prev, ...page.rows])
      setExtraRatings((prev) => ({ ...prev, ...page.ratings }))
      setCursor(page.nextCursor)
    } catch {
      // Réseau : on garde le curseur, un second clic retente la même page.
    } finally {
      setLoading(false)
    }
  }

  const pill = (active: boolean) =>
    cn(
      'label-data-inline tap-target cursor-pointer rounded-sm px-2 py-1 text-[9px] transition-colors',
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
              <MvCard mv={mv} rating={allRatings[mv.id]} timeZone={timeZone} />
            </li>
          ))}
        </ul>
      )}
      {/* Uniquement sur « All » : le flux Following arrive complet du serveur,
          un bouton y promettrait une suite qui n'existe pas. */}
      {feed === 'all' && cursor && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => void onLoadMore()}
            disabled={loading}
            className="border-border hover:bg-hover focus-visible:ring-ring/50 w-full cursor-pointer rounded-lg border py-2.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </section>
  )
}
