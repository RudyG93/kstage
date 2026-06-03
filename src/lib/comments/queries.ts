import { createClient } from '@/lib/supabase/server'
import type { FlatComment } from './tree'

export interface CommentEdit {
  previous_body: string
  edited_at: string
}

/** Versions précédentes d'un commentaire (pour "View history"), récentes d'abord. */
export async function getCommentEditHistory(commentId: string): Promise<CommentEdit[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('comment_edit_history')
    .select('previous_body, edited_at')
    .eq('comment_id', commentId)
    .order('edited_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Nombre de commentaires (non supprimés) postés par un user — stat de profil. */
export async function countUserComments(userId: string): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null)
  return count ?? 0
}

/**
 * Récupère tous les commentaires d'un event + agrégats votes + profil auteur.
 *
 * **3 queries** au lieu d'un embed Supabase parce qu'il n'existe pas de FK
 * directe `comments → profiles` (les deux tables pointent indépendamment vers
 * `auth.users(id)`). PostgREST ne fait pas de jointure transitive → un embed
 * `.select('..., profiles(...)')` retourne PGRST200 au schema-resolution.
 *
 *   1. comments (sans embed)
 *   2. comment_votes pour les ids retournés en 1 — agrège score + userVote
 *   3. profiles pour les distinct user_ids — author par row
 *
 * Les queries 2 et 3 sont indépendantes → `Promise.all` (2 round-trips, pas 3).
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
    .select('id, event_id, user_id, parent_id, body, created_at, updated_at, deleted_at')
    .eq('event_id', eventId)
  if (error) throw error
  const list = rows ?? []
  if (list.length === 0) return []

  const ids = list.map((r) => r.id)
  const userIds = [...new Set(list.map((r) => r.user_id))]

  const [votesRes, profilesRes] = await Promise.all([
    supabase.from('comment_votes').select('comment_id, user_id, value').in('comment_id', ids),
    supabase.from('profiles').select('id, username, avatar_url').in('id', userIds),
  ])

  const scoreByComment = new Map<string, number>()
  const userVoteByComment = new Map<string, -1 | 1>()
  for (const v of votesRes.data ?? []) {
    scoreByComment.set(v.comment_id, (scoreByComment.get(v.comment_id) ?? 0) + v.value)
    if (viewerId && v.user_id === viewerId) {
      userVoteByComment.set(v.comment_id, v.value === 1 ? 1 : -1)
    }
  }

  const profileById = new Map<string, { username: string | null; avatar_url: string | null }>()
  for (const p of profilesRes.data ?? []) {
    profileById.set(p.id, { username: p.username, avatar_url: p.avatar_url })
  }

  return list.map((r) => {
    const profile = profileById.get(r.user_id) ?? null
    return {
      id: r.id,
      event_id: r.event_id,
      user_id: r.user_id,
      parent_id: r.parent_id,
      body: r.body,
      created_at: r.created_at,
      updated_at: r.updated_at,
      deleted_at: r.deleted_at,
      author: profile,
      score: scoreByComment.get(r.id) ?? 0,
      userVote: userVoteByComment.get(r.id) ?? null,
    }
  })
}
