export const MIN_SCORE = 0
export const MAX_SCORE = 10
export const SCORE_STEP = 0.5

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface RatingInput {
  eventId: string
  score: number
}

export interface RawRating {
  eventId: string
  score: string
}

/** Valide une saisie user non fiable pour la Server Action `rateEvent`.
 * Échelle [0,10] par pas de 0.5 (§1). */
export function parseRatingInput(raw: RawRating): { error: string } | { value: RatingInput } {
  const eventId = (raw.eventId ?? '').trim()
  if (!UUID_RE.test(eventId)) return { error: 'Invalid event reference.' }

  const scoreStr = (raw.score ?? '').trim()
  // Entier ou décimale à une décimale (ex: "7", "7.5", "0", "10").
  if (!/^\d+(\.\d)?$/.test(scoreStr)) return { error: 'Invalid score.' }
  const score = Number(scoreStr)
  if (Number.isNaN(score) || score < MIN_SCORE || score > MAX_SCORE) {
    return { error: `Score must be between ${MIN_SCORE} and ${MAX_SCORE}.` }
  }
  if ((score * 2) % 1 !== 0) return { error: 'Score must be a multiple of 0.5.' }

  return { value: { eventId, score } }
}
