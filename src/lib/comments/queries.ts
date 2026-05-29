import { createClient } from '@/lib/supabase/server'
import type { FlatComment } from './tree'

/**
 * Récupère tous les commentaires d'un event + agrégats votes.
 * 2 queries (pas de N+1) :
 *   1. comments + profiles!left(username, avatar_url)
 *   2. comment_votes pour la liste d'ids retournés en 1
 * Agrégation en mémoire : Map<commentId, score> + Map<commentId, userVote>.
 *
 * Le user_id du voter courant (`viewerId`) est utilisé pour calculer `userVote`.
 * Passer null si pas connecté.
 */
export async function getCommentsForEvent(
  eventId: string,
  viewerId: string | null,
): Promise<FlatComment[]> {
  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('comments')
    .select(
      'id, event_id, user_id, parent_id, body, created_at, updated_at, deleted_at, profiles(username, avatar_url)',
    )
    .eq('event_id', eventId)
  if (error) throw error
  const list = rows ?? []
  if (list.length === 0) return []

  const ids = list.map((r) => r.id)
  const { data: votes } = await supabase
    .from('comment_votes')
    .select('comment_id, user_id, value')
    .in('comment_id', ids)

  const scoreByComment = new Map<string, number>()
  const userVoteByComment = new Map<string, -1 | 1>()
  for (const v of votes ?? []) {
    scoreByComment.set(v.comment_id, (scoreByComment.get(v.comment_id) ?? 0) + v.value)
    if (viewerId && v.user_id === viewerId) {
      userVoteByComment.set(v.comment_id, v.value === 1 ? 1 : -1)
    }
  }

  return list.map((r) => {
    const profileRaw = (r as { profiles: unknown }).profiles
    const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as {
      username: string | null
      avatar_url: string | null
    } | null
    return {
      id: r.id,
      event_id: r.event_id,
      user_id: r.user_id,
      parent_id: r.parent_id,
      body: r.body,
      created_at: r.created_at,
      updated_at: r.updated_at,
      deleted_at: r.deleted_at,
      author: profile
        ? { username: profile.username ?? null, avatar_url: profile.avatar_url ?? null }
        : null,
      score: scoreByComment.get(r.id) ?? 0,
      userVote: userVoteByComment.get(r.id) ?? null,
    }
  })
}
