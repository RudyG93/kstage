import type { Route } from 'next'
import Link from 'next/link'
import { groupHref } from '@/lib/events/href'
import { MvCard } from '@/components/group/mv-card'
import type { MvEvent } from '@/lib/events/queries'

/**
 * Rail droit de /mv/[slug] (round 2026-07-18 — « utilisons tout l'espace ») :
 * le catalogue du groupe en colonne, à la place du SidebarRight générique.
 * Desktop-only via PageRails ; sur mobile la grille « More from » in-column
 * reste seule (lg:hidden côté page).
 */
export function MvRightRail({
  groupName,
  groupSlug,
  groupArtistSlug,
  mvs,
  ratings,
  timeZone,
}: {
  groupName: string
  groupSlug: string
  /** Cible réelle d'un soliste : /groups/<slug> redirige (cf. groupHref). */
  groupArtistSlug?: string | null
  mvs: MvEvent[]
  ratings: Map<string, { avg: number; count: number }>
  timeZone: string
}) {
  return (
    <div className="space-y-2 lg:sticky lg:top-20">
      <div className="flex items-baseline justify-between">
        <span className="label-data">More from {groupName}</span>
        <Link
          href={groupHref({ slug: groupSlug, artist_slug: groupArtistSlug }) as Route}
          className="label-data-inline text-primary hover:text-primary/80 text-[10px] font-semibold transition-colors"
        >
          All MVs →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-[9px]">
        {mvs.map((mv) => (
          <MvCard key={mv.id} mv={mv} rating={ratings.get(mv.id)} timeZone={timeZone} />
        ))}
      </div>
    </div>
  )
}
