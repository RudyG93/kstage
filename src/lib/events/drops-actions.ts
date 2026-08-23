'use server'

import { decodeMvCursor, getMvsPage, type MvEvent } from '@/lib/events/queries'
import { getRatingsForEvents } from '@/lib/events/community'
import type { DropsRating } from '@/components/mv/drops-grid'

/**
 * Page suivante de la grille « Latest drops ».
 *
 * Server action et pas `?page=` : R5 a démonté les pills `<Link>` de cette
 * page précisément parce que chaque clic re-rendait tout le serveur. Ici on
 * n'échange que les 30 lignes suivantes.
 *
 * Les notes des nouvelles lignes voyagent avec elles : sans ça, les clips
 * chargés après le premier écran afficheraient tous « Be the first to rate »,
 * y compris ceux qui sont notés.
 */
export async function loadMoreDrops(rawCursor: string): Promise<{
  rows: MvEvent[]
  ratings: Record<string, DropsRating>
  nextCursor: string | null
}> {
  const cursor = decodeMvCursor(rawCursor)
  if (!cursor) return { rows: [], ratings: {}, nextCursor: null }
  const { rows, nextCursor } = await getMvsPage({ cursor, limit: 30 })
  const ratings = rows.length > 0 ? await getRatingsForEvents(rows.map((m) => m.id)) : new Map()
  return { rows, ratings: Object.fromEntries(ratings), nextCursor }
}
