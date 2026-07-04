import { describe, it, expect } from 'vitest'
import {
  getKstMonthRange,
  kstDayKey,
  groupEventsByKstDay,
  formatEventDate,
  formatKst,
  kstTime24h,
  formatDDay,
  relativeTime,
} from './date'

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

describe('formatKst', () => {
  it('formats an instant in Seoul time with the requested fields', () => {
    // 09:00Z = 18:00 KST le même jour.
    expect(
      formatKst('2026-03-24T09:00:00Z', { hour: '2-digit', minute: '2-digit', hour12: false }),
    ).toBe('18:00')
  })

  it('rolls to the next KST day after 15:00Z', () => {
    // 16:00Z = 01:00 KST le lendemain.
    expect(formatKst('2026-03-24T16:00:00Z', { month: 'short', day: '2-digit' })).toBe('Mar 25')
  })
})

describe('kstTime24h', () => {
  it('renders a 24h KST clock without AM/PM', () => {
    expect(kstTime24h('2026-03-24T09:00:00Z')).toBe('18:00')
    expect(kstTime24h('2026-03-24T15:30:00Z')).toBe('00:30')
  })
})

describe('formatDDay', () => {
  // now = 2026-07-02 12:00 KST (03:00 UTC)
  const now = '2026-07-02T03:00:00Z'

  it('returns D-DAY for the same calendar day in the given timezone', () => {
    expect(formatDDay('2026-07-02T13:00:00Z', 'Asia/Seoul', now)).toBe('D-DAY')
  })

  it('counts calendar days, not 24h windows', () => {
    // 2026-07-03 09:00 KST = lendemain matin → D-1 même si <24h d'écart.
    expect(formatDDay('2026-07-03T00:00:00Z', 'Asia/Seoul', now)).toBe('D-1')
    expect(formatDDay('2026-07-04T10:00:00Z', 'Asia/Seoul', now)).toBe('D-2')
  })

  it('depends on the timezone: same instant, different day', () => {
    // 2026-07-02 17:00 UTC = 2026-07-03 02:00 KST (D-1) mais 19:00 le 2 à Paris (D-DAY).
    const iso = '2026-07-02T17:00:00Z'
    expect(formatDDay(iso, 'Asia/Seoul', now)).toBe('D-1')
    expect(formatDDay(iso, 'Europe/Paris', now)).toBe('D-DAY')
  })

  it('labels past days with D+', () => {
    expect(formatDDay('2026-06-30T03:00:00Z', 'Asia/Seoul', now)).toBe('D+2')
  })
})

describe('relativeTime', () => {
  const now = Date.parse('2026-07-04T12:00:00Z')

  it('gradue minutes → heures → jours → semaines → mois → années', () => {
    expect(relativeTime('2026-07-04T11:59:40Z', now)).toBe('just now')
    expect(relativeTime('2026-07-04T11:45:00Z', now)).toBe('15m ago')
    expect(relativeTime('2026-07-04T07:00:00Z', now)).toBe('5h ago')
    expect(relativeTime('2026-07-01T12:00:00Z', now)).toBe('3d ago')
    expect(relativeTime('2026-06-15T12:00:00Z', now)).toBe('2w ago')
    expect(relativeTime('2026-03-04T12:00:00Z', now)).toBe('4mo ago')
    expect(relativeTime('2024-07-04T12:00:00Z', now)).toBe('2y ago')
  })
})
