// Limites alignées sur la contrainte DB `comments_body_len`
// (cf. supabase/migrations/0009_community.sql:60).
export const BODY_MIN = 1
export const BODY_MAX = 5000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface CommentInput {
  eventId: string
  parentId: string | null
  body: string
}

export interface RawComment {
  eventId: string
  parentId?: string | null
  body: string
}

/** Valide une saisie user non fiable pour `postComment` / `editComment`. */
export function parseCommentInput(raw: RawComment): { error: string } | { value: CommentInput } {
  const eventId = (raw.eventId ?? '').trim()
  if (!UUID_RE.test(eventId)) return { error: 'Invalid event reference.' }

  const parentRaw = (raw.parentId ?? '').toString().trim()
  let parentId: string | null = null
  if (parentRaw) {
    if (!UUID_RE.test(parentRaw)) return { error: 'Invalid parent reference.' }
    parentId = parentRaw
  }

  const body = (raw.body ?? '').replace(/\r\n/g, '\n').trim()
  if (body.length < BODY_MIN) return { error: 'Comment cannot be empty.' }
  if (body.length > BODY_MAX) return { error: `Comment is too long (${BODY_MAX} chars max).` }

  return { value: { eventId, parentId, body } }
}

export interface EditInput {
  commentId: string
  body: string
}
export interface RawEdit {
  commentId: string
  body: string
}

export function parseEditInput(raw: RawEdit): { error: string } | { value: EditInput } {
  const commentId = (raw.commentId ?? '').trim()
  if (!UUID_RE.test(commentId)) return { error: 'Invalid comment reference.' }
  const body = (raw.body ?? '').replace(/\r\n/g, '\n').trim()
  if (body.length < BODY_MIN) return { error: 'Comment cannot be empty.' }
  if (body.length > BODY_MAX) return { error: `Comment is too long (${BODY_MAX} chars max).` }
  return { value: { commentId, body } }
}

export interface VoteInput {
  commentId: string
  value: -1 | 1
}
export interface RawVote {
  commentId: string
  value: string
}

export function parseVoteInput(raw: RawVote): { error: string } | { value: VoteInput } {
  const commentId = (raw.commentId ?? '').trim()
  if (!UUID_RE.test(commentId)) return { error: 'Invalid comment reference.' }
  const v = (raw.value ?? '').trim()
  if (v !== '1' && v !== '-1') return { error: 'Vote value must be +1 or -1.' }
  return { value: { commentId, value: v === '1' ? 1 : -1 } }
}

export interface IdInput {
  commentId: string
}
export interface RawId {
  commentId: string
}

export function parseCommentId(raw: RawId): { error: string } | { value: IdInput } {
  const commentId = (raw.commentId ?? '').trim()
  if (!UUID_RE.test(commentId)) return { error: 'Invalid comment reference.' }
  return { value: { commentId } }
}
