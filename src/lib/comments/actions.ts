'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parseCommentInput, parseCommentId, parseEditInput, parseVoteInput } from './validation'
import { getCommentEditHistory, type CommentEdit } from './queries'

export type CommentState = { error: string } | { ok: true; commentId?: string } | null

// Rate-limit anti-spam : max 5 commentaires par fenêtre de 60 s par user.
// Check atomique côté DB (RPC consume_rate_limit, advisory lock) — un burst
// parallèle ne peut pas dépasser le cap, contrairement à l'ancien count+insert.
const COMMENT_RATE_WINDOW_SECONDS = 60
const COMMENT_RATE_MAX = 5

function revalidateSlug(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  // Whitelist anti revalidatePath arbitraire (pattern rating-actions:47).
  if (/^[a-z0-9-]+$/.test(slug)) revalidatePath(`/mv/${slug}`)
}

/** Post un commentaire (root si parentId vide, sinon reply). */
export async function postComment(_prev: CommentState, formData: FormData): Promise<CommentState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = parseCommentInput({
    eventId: String(formData.get('eventId') ?? ''),
    parentId: String(formData.get('parentId') ?? ''),
    body: String(formData.get('body') ?? ''),
  })
  if ('error' in parsed) return { error: parsed.error }

  const { data: allowed, error: rateErr } = await supabase.rpc('consume_rate_limit', {
    p_action: 'comment',
    p_max: COMMENT_RATE_MAX,
    p_window_seconds: COMMENT_RATE_WINDOW_SECONDS,
  })
  if (rateErr) return { error: 'Could not post your comment. Please try again.' }
  if (!allowed) {
    return { error: 'You are commenting too fast. Please wait a moment.' }
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      event_id: parsed.value.eventId,
      parent_id: parsed.value.parentId,
      user_id: user.id,
      body: parsed.value.body,
    })
    .select('id')
    .single()
  if (error) return { error: 'Could not post your comment. Please try again.' }

  revalidateSlug(formData)
  return { ok: true, commentId: data.id }
}

/** Edit body d'un comment own (non soft-deleted). RLS double-check via policy update. */
export async function editComment(_prev: CommentState, formData: FormData): Promise<CommentState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = parseEditInput({
    commentId: String(formData.get('commentId') ?? ''),
    body: String(formData.get('body') ?? ''),
  })
  if ('error' in parsed) return { error: parsed.error }

  // Archive l'ancien body avant l'update (pour "View history"), si modifié.
  const { data: current } = await supabase
    .from('comments')
    .select('body')
    .eq('id', parsed.value.commentId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  const { error } = await supabase
    .from('comments')
    .update({ body: parsed.value.body, updated_at: new Date().toISOString() })
    .eq('id', parsed.value.commentId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
  if (error) return { error: 'Could not save your edit. Please try again.' }

  if (current && current.body !== parsed.value.body) {
    // Best-effort : l'échec d'archivage ne bloque pas l'édition.
    await supabase.from('comment_edit_history').insert({
      comment_id: parsed.value.commentId,
      user_id: user.id,
      previous_body: current.body,
    })
  }

  revalidateSlug(formData)
  return { ok: true, commentId: parsed.value.commentId }
}

/** Soft-delete : UPDATE deleted_at = now() pour préserver les enfants. */
export async function deleteComment(
  _prev: CommentState,
  formData: FormData,
): Promise<CommentState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = parseCommentId({ commentId: String(formData.get('commentId') ?? '') })
  if ('error' in parsed) return { error: parsed.error }

  const { error } = await supabase
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.value.commentId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
  if (error) return { error: 'Could not delete your comment. Please try again.' }

  revalidateSlug(formData)
  return { ok: true, commentId: parsed.value.commentId }
}

/**
 * Vote +1 / -1. Toggle si même valeur déjà en DB (DELETE).
 * Sinon upsert sur la PK composite (user_id, comment_id).
 */
export async function voteComment(_prev: CommentState, formData: FormData): Promise<CommentState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = parseVoteInput({
    commentId: String(formData.get('commentId') ?? ''),
    value: String(formData.get('value') ?? ''),
  })
  if ('error' in parsed) return { error: parsed.error }
  const { commentId, value } = parsed.value

  const { data: existing } = await supabase
    .from('comment_votes')
    .select('value')
    .eq('user_id', user.id)
    .eq('comment_id', commentId)
    .maybeSingle()

  if (existing?.value === value) {
    // Toggle : retirer le vote.
    const { error } = await supabase
      .from('comment_votes')
      .delete()
      .eq('user_id', user.id)
      .eq('comment_id', commentId)
    if (error) return { error: 'Could not toggle your vote. Please try again.' }
  } else {
    const { error } = await supabase
      .from('comment_votes')
      .upsert(
        { user_id: user.id, comment_id: commentId, value },
        { onConflict: 'user_id,comment_id' },
      )
    if (error) return { error: 'Could not save your vote. Please try again.' }
  }

  revalidateSlug(formData)
  return { ok: true, commentId }
}

/** Server action : historique d'édition d'un commentaire (pour "View history"). */
export async function fetchEditHistory(commentId: string): Promise<CommentEdit[]> {
  const parsed = parseCommentId({ commentId })
  if ('error' in parsed) return []
  return getCommentEditHistory(parsed.value.commentId)
}

/** Signale un commentaire (modération admin via `/admin/reports`). */
export async function reportComment(
  commentId: string,
  reason: string,
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = parseCommentId({ commentId })
  if ('error' in parsed) return { error: parsed.error }

  const { error } = await supabase.from('comment_report').insert({
    comment_id: parsed.value.commentId,
    reporter_id: user.id,
    reason: reason.trim().slice(0, 500) || null,
  })
  // unique(comment_id, reporter_id) : déjà signalé → on considère ça OK.
  if (error && !/duplicate key|unique/i.test(error.message)) {
    return { error: 'Could not submit your report. Please try again.' }
  }
  return { ok: true }
}
