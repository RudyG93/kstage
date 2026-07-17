import { describe, it, expect } from 'vitest'
import { bucketScores, bucketLabel, BUCKET_COUNT } from './rating-distribution'

describe('bucketScores — 20 buckets demi-points', () => {
  it('un 8.5 tombe dans SA barre, pas dans celle du 9 (bug Math.ceil du 2026-07-17)', () => {
    const buckets = bucketScores([8.5])
    expect(buckets[16]).toBe(1) // bucket « 8.5 »
    expect(buckets[17]).toBe(0) // bucket « 9 »
    expect(buckets[15]).toBe(0) // bucket « 8 »
  })

  it('les entiers gardent leur barre exacte', () => {
    const buckets = bucketScores([9, 1, 10])
    expect(buckets[17]).toBe(1) // « 9 »
    expect(buckets[1]).toBe(1) // « 1 »
    expect(buckets[19]).toBe(1) // « 10 » = dernière barre
  })

  it('le 0 (légal en DB) est fusionné dans la première barre', () => {
    const buckets = bucketScores([0, 0.5])
    expect(buckets[0]).toBe(2)
  })

  it('sans note : 20 buckets vides', () => {
    const buckets = bucketScores([])
    expect(buckets).toHaveLength(BUCKET_COUNT)
    expect(buckets.every((c) => c === 0)).toBe(true)
  })

  it('la somme des buckets = le nombre de notes', () => {
    const scores = [0, 0.5, 1, 4.5, 7.5, 8.5, 8.5, 9, 10]
    const buckets = bucketScores(scores)
    expect(buckets.reduce((a, b) => a + b, 0)).toBe(scores.length)
    expect(buckets).toHaveLength(BUCKET_COUNT)
  })
})

describe('bucketLabel', () => {
  it('étiquette chaque bucket par sa note (0.5 … 10)', () => {
    expect(bucketLabel(0)).toBe('0.5')
    expect(bucketLabel(15)).toBe('8')
    expect(bucketLabel(16)).toBe('8.5')
    expect(bucketLabel(19)).toBe('10')
  })
})
