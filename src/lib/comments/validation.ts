// Limite app < contrainte DB `comments_body_len` (5000, migration 0009) : 2000
// suffit largement pour un avis de fan et coupe les pavés.
export const BODY_MIN = 1
export const BODY_MAX = 2000
// Anti mur-de-texte (« une lettre par ligne ») : au-delà = rejet.
export const MAX_LINES = 25

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Blocklist anti-spam basique (mots/patterns). La config admin est V2 — pour
// l'instant une constante. Orientée spam plutôt que profanité casual (évite les
// faux positifs dans une communauté de fans).
export const BLOCKED_PATTERNS: readonly RegExp[] = [
  /\bviagra\b/i,
  /\bcialis\b/i,
  /\bcasino\b/i,
  /\b(?:buy|cheap)\s+(?:followers|views|likes)\b/i,
  /https?:\/\/\S+\.(?:ru|tk|top|xyz)\b/i,
]

export function containsBlockedContent(body: string): boolean {
  return BLOCKED_PATTERNS.some((re) => re.test(body))
}

/** Normalise un body : CRLF→LF, max 1 ligne vide consécutive, trim. */
export function normalizeBody(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Rejette les murs de texte (trop de lignes — ex. « une lettre par ligne »). */
function tooManyLines(body: string): boolean {
  return body.split('\n').length > MAX_LINES
}

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

  const body = normalizeBody(raw.body ?? '')
  if (body.length < BODY_MIN) return { error: 'Comment cannot be empty.' }
  if (body.length > BODY_MAX) return { error: `Comment is too long (${BODY_MAX} chars max).` }
  if (tooManyLines(body)) return { error: 'Too many line breaks — please tighten your comment.' }
  if (containsBlockedContent(body)) return { error: 'Your comment was blocked by our spam filter.' }

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
  const body = normalizeBody(raw.body ?? '')
  if (body.length < BODY_MIN) return { error: 'Comment cannot be empty.' }
  if (body.length > BODY_MAX) return { error: `Comment is too long (${BODY_MAX} chars max).` }
  if (tooManyLines(body)) return { error: 'Too many line breaks — please tighten your comment.' }
  if (containsBlockedContent(body)) return { error: 'Your comment was blocked by our spam filter.' }
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
