import { describe, it, expect } from 'vitest'
import { parseRatingInput } from './rating-validation'

const VALID_UUID = '11111111-2222-3333-4444-555555555555'

describe('parseRatingInput', () => {
  it('accepte un score entier 0-10', () => {
    expect(parseRatingInput({ eventId: VALID_UUID, score: '7' })).toEqual({
      value: { eventId: VALID_UUID, score: 7 },
    })
  })

  it('accepte les demi-points (0.5)', () => {
    expect(parseRatingInput({ eventId: VALID_UUID, score: '7.5' })).toEqual({
      value: { eventId: VALID_UUID, score: 7.5 },
    })
    expect(parseRatingInput({ eventId: VALID_UUID, score: '0.5' })).toEqual({
      value: { eventId: VALID_UUID, score: 0.5 },
    })
  })

  it('accepte les bornes 0 et 10', () => {
    expect(parseRatingInput({ eventId: VALID_UUID, score: '0' })).toEqual({
      value: { eventId: VALID_UUID, score: 0 },
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
    expect(parseRatingInput({ eventId: VALID_UUID, score: '11' })).toMatchObject({
      error: expect.stringContaining('between'),
    })
  })

  it('rejette un pas non multiple de 0.5', () => {
    expect(parseRatingInput({ eventId: VALID_UUID, score: '7.3' })).toMatchObject({
      error: expect.stringContaining('0.5'),
    })
  })

  it('rejette un format invalide (négatif, vide, deux décimales)', () => {
    expect(parseRatingInput({ eventId: VALID_UUID, score: '-3' })).toMatchObject({
      error: 'Invalid score.',
    })
    expect(parseRatingInput({ eventId: VALID_UUID, score: '' })).toMatchObject({
      error: 'Invalid score.',
    })
    expect(parseRatingInput({ eventId: VALID_UUID, score: '7.55' })).toMatchObject({
      error: 'Invalid score.',
    })
  })

  it('trim les inputs', () => {
    expect(parseRatingInput({ eventId: `  ${VALID_UUID}  `, score: '  8  ' })).toEqual({
      value: { eventId: VALID_UUID, score: 8 },
    })
  })
})
