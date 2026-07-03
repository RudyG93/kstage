import { describe, it, expect } from 'vitest'
import { aggregateWindow, computeRankDeltas, type RatingRow } from './top-rated'
import { bucketScores } from './rating-distribution'

const row = (event_id: string, score: number, created_at: string): RatingRow => ({
  event_id,
  score,
  created_at,
})

describe('aggregateWindow', () => {
  it('averages scores per event inside the window and applies the min-count threshold', () => {
    const rows = [
      row('a', 8, '2026-07-01T00:00:00Z'),
      row('a', 9, '2026-07-02T00:00:00Z'),
      row('b', 10, '2026-07-01T12:00:00Z'), // 1 seul vote → sous le seuil
      row('a', 5, '2026-06-20T00:00:00Z'), // hors fenêtre
    ]
    const out = aggregateWindow(rows, '2026-06-28T00:00:00Z', '2026-07-05T00:00:00Z', 2)
    expect(out).toEqual([{ eventId: 'a', avg: 8.5, count: 2 }])
  })

  it('sorts by average desc, then count desc', () => {
    const rows = [
      row('a', 8, '2026-07-01T00:00:00Z'),
      row('a', 8, '2026-07-01T01:00:00Z'),
      row('b', 9, '2026-07-01T02:00:00Z'),
      row('b', 9, '2026-07-01T03:00:00Z'),
      row('c', 8, '2026-07-01T04:00:00Z'),
      row('c', 8, '2026-07-01T05:00:00Z'),
      row('c', 8, '2026-07-01T06:00:00Z'),
    ]
    const out = aggregateWindow(rows, '2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z', 2)
    expect(out.map((e) => e.eventId)).toEqual(['b', 'c', 'a'])
  })
})

describe('computeRankDeltas', () => {
  const e = (eventId: string): { eventId: string; avg: number; count: number } => ({
    eventId,
    avg: 8,
    count: 3,
  })

  it('labels climbs, drops, holds and entries', () => {
    const current = [e('a'), e('b'), e('c'), e('d')]
    const previous = [e('b'), e('a'), e('c')]
    const deltas = computeRankDeltas(current, previous)
    expect(deltas.get('a')).toEqual({ kind: 'up', n: 1 })
    expect(deltas.get('b')).toEqual({ kind: 'down', n: 1 })
    expect(deltas.get('c')).toEqual({ kind: 'same', n: 0 })
    expect(deltas.get('d')).toEqual({ kind: 'new', n: 0 })
  })
})

describe('bucketScores', () => {
  it('rounds half-scores up and clamps 0 into the first bucket', () => {
    const buckets = bucketScores([0, 0.5, 1, 7.5, 10])
    expect(buckets[0]).toBe(3) // 0, 0.5 et 1 → bucket 1
    expect(buckets[7]).toBe(1) // 7.5 → bucket 8
    expect(buckets[9]).toBe(1) // 10 → bucket 10
    expect(buckets.reduce((a, b) => a + b, 0)).toBe(5)
  })

  it('returns 10 empty buckets for no scores', () => {
    expect(bucketScores([])).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })
})
