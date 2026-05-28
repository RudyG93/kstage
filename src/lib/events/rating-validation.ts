export const MIN_SCORE = 1
export const MAX_SCORE = 10

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface RatingInput {
  eventId: string
  score: number
}

export interface RawRating {
  eventId: string
  score: string
}

/** Valide une saisie user non fiable pour la Server Action `rateEvent`. */
export function parseRatingInput(raw: RawRating): { error: string } | { value: RatingInput } {
  const eventId = (raw.eventId ?? '').trim()
  if (!UUID_RE.test(eventId)) return { error: 'Invalid event reference.' }

  const scoreStr = (raw.score ?? '').trim()
  if (!/^\d+$/.test(scoreStr)) return { error: 'Score must be a whole number.' }
  const score = Number(scoreStr)
  if (score < MIN_SCORE || score > MAX_SCORE) {
    return { error: `Score must be between ${MIN_SCORE} and ${MAX_SCORE}.` }
  }

  return { value: { eventId, score } }
}
