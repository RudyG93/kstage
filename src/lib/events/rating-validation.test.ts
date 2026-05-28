import { describe, it, expect } from 'vitest'
import { parseRatingInput } from './rating-validation'

const VALID_UUID = '11111111-2222-3333-4444-555555555555'

describe('parseRatingInput', () => {
  it('accepte un eventId UUID + score entier 1-10', () => {
    expect(parseRatingInput({ eventId: VALID_UUID, score: '7' })).toEqual({
      value: { eventId: VALID_UUID, score: 7 },
    })
  })

  it('accepte les bornes 1 et 10', () => {
    expect(parseRatingInput({ eventId: VALID_UUID, score: '1' })).toEqual({
      value: { eventId: VALID_UUID, score: 1 },
    })
    expect(parseRatingInput({ eventId: VALID_UUID, score: '10' })).toEqual({
      value: { eventId: VALID_UUID, score: 10 },
    })
  })

  it('rejette un eventId non-UUID', () => {
    expect(parseRatingInput({ eventId: 'not-a-uuid', score: '5' })).toEqual({
      error: 'Invalid event reference.',
    })
  })

  it('rejette un score hors range', () => {
    expect(parseRatingInput({ eventId: VALID_UUID, score: '0' })).toMatchObject({
      error: expect.stringContaining('between'),
    })
    expect(parseRatingInput({ eventId: VALID_UUID, score: '11' })).toMatchObject({
      error: expect.stringContaining('between'),
    })
  })

  it('rejette un score non-entier (décimal, négatif, vide)', () => {
    expect(parseRatingInput({ eventId: VALID_UUID, score: '7.5' })).toEqual({
      error: 'Score must be a whole number.',
    })
    expect(parseRatingInput({ eventId: VALID_UUID, score: '-3' })).toEqual({
      error: 'Score must be a whole number.',
    })
    expect(parseRatingInput({ eventId: VALID_UUID, score: '' })).toEqual({
      error: 'Score must be a whole number.',
    })
  })

  it('trim les inputs', () => {
    expect(parseRatingInput({ eventId: `  ${VALID_UUID}  `, score: '  8  ' })).toEqual({
      value: { eventId: VALID_UUID, score: 8 },
    })
  })
})
