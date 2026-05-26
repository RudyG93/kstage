import { describe, it, expect } from 'vitest'
import { splitUpcomingByWeek } from './grouping'
import type { UpcomingEvent } from './queries'

const ev = (id: string, start_at: string) => ({ id, start_at }) as unknown as UpcomingEvent

describe('splitUpcomingByWeek', () => {
  const now = new Date('2026-06-01T00:00:00Z').getTime()

  it('range ≤ 7 jours dans thisWeek, le reste dans later', () => {
    const events = [
      ev('a', '2026-06-02T00:00:00Z'), // J+1
      ev('b', '2026-06-08T00:00:00Z'), // J+7 (limite incluse)
      ev('c', '2026-06-20T00:00:00Z'), // J+19
    ]
    const { thisWeek, later } = splitUpcomingByWeek(events, now)
    expect(thisWeek.map((e) => e.id)).toEqual(['a', 'b'])
    expect(later.map((e) => e.id)).toEqual(['c'])
  })

  it('liste vide → deux buckets vides', () => {
    expect(splitUpcomingByWeek([], now)).toEqual({ thisWeek: [], later: [] })
  })
})
