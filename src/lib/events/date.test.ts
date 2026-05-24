import { describe, it, expect } from 'vitest'
import { getKstMonthRange, kstDayKey, groupEventsByKstDay, formatEventDate } from './date'

describe('getKstMonthRange', () => {
  it('returns the KST month boundaries as UTC ISO', () => {
    // Mai 2026 KST : 1er mai 00:00 KST = 30 avril 15:00 UTC.
    const { startISO, endISO } = getKstMonthRange(2026, 5)
    expect(startISO).toBe('2026-04-30T15:00:00.000Z')
    expect(endISO).toBe('2026-05-31T15:00:00.000Z')
  })

  it('handles the December → January rollover', () => {
    const { startISO, endISO } = getKstMonthRange(2026, 12)
    expect(startISO).toBe('2026-11-30T15:00:00.000Z')
    expect(endISO).toBe('2026-12-31T15:00:00.000Z')
  })
})

describe('kstDayKey', () => {
  it('keeps the same KST day before midnight', () => {
    // 14:00 UTC = 23:00 KST le même jour.
    expect(kstDayKey('2026-05-15T14:00:00Z')).toBe('2026-05-15')
  })

  it('rolls to the next KST day after 15:00 UTC', () => {
    // 23:00 UTC le 15 = 08:00 KST le 16.
    expect(kstDayKey('2026-05-15T23:00:00Z')).toBe('2026-05-16')
  })
})

describe('groupEventsByKstDay', () => {
  it('buckets events by their KST day', () => {
    const events = [
      { start_at: '2026-05-15T14:00:00Z', id: 'a' },
      { start_at: '2026-05-15T23:00:00Z', id: 'b' },
      { start_at: '2026-05-16T01:00:00Z', id: 'c' },
    ]
    const map = groupEventsByKstDay(events)
    expect(map.get('2026-05-15')?.map((e) => e.id)).toEqual(['a'])
    expect(map.get('2026-05-16')?.map((e) => e.id)).toEqual(['b', 'c'])
  })
})

describe('formatEventDate', () => {
  it('formats a UTC instant in the given timezone', () => {
    const result = formatEventDate('2026-06-15T09:00:00Z', 'Asia/Seoul')
    expect(result).toMatch(/Jun.*15.*2026/)
  })

  it('shifts the local day according to the timezone', () => {
    const seoul = formatEventDate('2026-06-15T23:00:00Z', 'Asia/Seoul')
    expect(seoul).toMatch(/Jun.*16.*2026/)
  })
})
