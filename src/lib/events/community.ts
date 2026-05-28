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
 * Charge un event par son slug (route `/mv/[slug]`). Retourne null si absent.
 * Joint les infos groupe nécessaires pour la page article.
 */
export async function getEventBySlug(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select(
      'id, slug, title, type, start_at, status, source_url, description, groups!inner(slug, name, color_hex, image_url, banner_url)',
    )
    .eq('slug', slug)
    .maybeSingle()
  return data
}
