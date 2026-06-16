import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export interface RatingSummary {
  avg: number | null // moyenne /10, null si aucun vote
  count: number
  userScore: number | null // ton score si connecté+voté, null sinon
}

/**
 * Agrégation des notes pour un event : moyenne, nombre de votes, et le score
 * du user courant s'il est connecté. SQL côté Postgres (une seule requête).
 */
export async function getEventRatingSummary(eventId: string): Promise<RatingSummary> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Toutes les notes de l'event (RLS permet le select public).
  const { data: ratings } = await supabase
    .from('event_ratings')
    .select('score, user_id')
    .eq('event_id', eventId)

  const rows = ratings ?? []
  const count = rows.length
  const avg = count === 0 ? null : rows.reduce((acc, r) => acc + r.score, 0) / count
  const userScore = user ? (rows.find((r) => r.user_id === user.id)?.score ?? null) : null

  return { avg, count, userScore }
}

/**
 * Version batch de la rating summary : agrège (avg, count) pour un set d'event
 * ids. Utile pour afficher les notes sur les grilles MV (`/groups/[slug]` et
 * `/mvs`) sans faire 1 query par card.
 *
 * Map vide renvoyée si la liste est vide (évite une query inutile).
 */
export async function getRatingsForEvents(
  eventIds: string[],
): Promise<Map<string, { avg: number; count: number }>> {
  const out = new Map<string, { avg: number; count: number }>()
  if (eventIds.length === 0) return out
  const supabase = await createClient()
  const { data } = await supabase
    .from('event_ratings')
    .select('event_id, score')
    .in('event_id', eventIds)
  for (const row of data ?? []) {
    const prev = out.get(row.event_id) ?? { avg: 0, count: 0 }
    const newCount = prev.count + 1
    const newAvg = (prev.avg * prev.count + row.score) / newCount
    out.set(row.event_id, { avg: newAvg, count: newCount })
  }
  return out
}

export interface LikeSummary {
  liked: boolean // le viewer a liké
  count: number // total des likes
}

/** Résumé des likes (mv_like) d'un event : total + état du viewer. */
export async function getLikeSummary(
  eventId: string,
  viewerId: string | null,
): Promise<LikeSummary> {
  const supabase = await createClient()
  const [{ count }, mine] = await Promise.all([
    supabase.from('mv_like').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
    viewerId
      ? supabase
          .from('mv_like')
          .select('user_id')
          .eq('event_id', eventId)
          .eq('user_id', viewerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return { liked: Boolean(mine.data), count: count ?? 0 }
}

/**
 * Charge un event par son slug (route `/mv/[slug]`). Retourne null si absent.
 * Joint les infos groupe nécessaires pour la page article.
 */
// `cache()` request-scoped : la route /mv/[slug] appelle getEventBySlug dans
// generateMetadata ET dans le composant page → une seule requête par render.
export const getEventBySlug = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select(
      'id, slug, title, type, start_at, status, source_url, description, groups!inner(slug, name, color_hex, image_url, banner_url)',
    )
    .eq('slug', slug)
    .maybeSingle()
  return data
})
