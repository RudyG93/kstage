import { describe, it, expect } from 'vitest'
import {
  getKstMonthRange,
  kstDayKey,
  kstDayBounds,
  groupEventsByKstDay,
  groupEventsByEventDay,
  formatEventDate,
  formatKst,
  kstTime24h,
  formatDDay,
  eventDayKey,
  eventDDay,
  relativeTime,
  kstToUtcISO,
  isTimeTBA,
} from './date'

describe('isTimeTBA', () => {
  const midnightKst = kstToUtcISO(2026, 5, 28) // 00:00 KST (heure technique par défaut)
  it('tentative à minuit KST → true (jour connu, heure inconnue)', () => {
    expect(isTimeTBA({ status: 'tentative', start_at: midnightKst })).toBe(true)
  })
  it('tentative à une heure réelle (slot music-show 18:00 KST) → false', () => {
    expect(isTimeTBA({ status: 'tentative', start_at: kstToUtcISO(2026, 5, 28, 18, 0) })).toBe(
      false,
    )
  })
  it('confirmed → false même à minuit KST', () => {
    expect(isTimeTBA({ status: 'confirmed', start_at: midnightKst })).toBe(false)
  })
  it('status ou start_at manquant → false', () => {
    expect(isTimeTBA({})).toBe(false)
    expect(isTimeTBA({ status: 'tentative' })).toBe(false)
  })
})

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

describe('eventDayKey / eventDDay — anniversaires = dates pures', () => {
  // Cas réel du bug 2026-07-17 : anniversaires ancrés à minuit KST, viewer à Paris.
  // Wonwoo (17/07) → start_at 2026-07-16T15:00Z ; Taemin (18/07) → 2026-07-17T15:00Z.
  const wonwoo = { start_at: kstToUtcISO(2026, 6, 17), type: 'anniversary' }
  const taemin = { start_at: kstToUtcISO(2026, 6, 18), type: 'anniversary' }
  // Music Bank le 17/07 à 17:00 KST (08:00Z) : un instant réel.
  const musicBank = { start_at: '2026-07-17T08:00:00Z', type: 'music_show' }
  // now = 17/07 02:40 à Paris (00:40Z) — le 17 dans les deux fuseaux.
  const now = '2026-07-17T00:40:00Z'

  it("un anniversaire garde sa date civile dans tous les fuseaux (pas de glissement à J-1 à l'ouest de Séoul)", () => {
    expect(eventDayKey(wonwoo, 'Europe/Paris')).toBe('2026-07-17')
    expect(eventDayKey(wonwoo, 'America/New_York')).toBe('2026-07-17')
    expect(eventDayKey(wonwoo, 'Asia/Seoul')).toBe('2026-07-17')
  })

  it('un event à heure réelle reste lu dans le fuseau du viewer', () => {
    expect(eventDayKey(musicBank, 'Europe/Paris')).toBe('2026-07-17')
    // 15:30Z = 00:30 KST le lendemain : le jour dépend bien du fuseau.
    const lateShow = { start_at: '2026-07-17T15:30:00Z', type: 'music_show' }
    expect(eventDayKey(lateShow, 'Asia/Seoul')).toBe('2026-07-18')
    expect(eventDayKey(lateShow, 'Europe/Paris')).toBe('2026-07-17')
  })

  it('le 17/07 à Paris : music show du 17 ET anniversaire du 17 → D-DAY ; anniversaire du 18 → D-1', () => {
    expect(eventDDay(musicBank, 'Europe/Paris', now)).toBe('D-DAY')
    expect(eventDDay(wonwoo, 'Europe/Paris', now)).toBe('D-DAY')
    expect(eventDDay(taemin, 'Europe/Paris', now)).toBe('D-1')
  })

  it("l'anniversaire reste D-DAY jusqu'à minuit local (23:30 à Paris = déjà le 18 en KST)", () => {
    expect(eventDDay(wonwoo, 'Europe/Paris', '2026-07-17T21:30:00Z')).toBe('D-DAY')
  })
})

describe('groupEventsByEventDay', () => {
  it('place les anniversaires sur leur date civile et les instants sur le jour local', () => {
    const events = [
      { id: 'bday', start_at: kstToUtcISO(2026, 6, 17), type: 'anniversary' },
      { id: 'show', start_at: '2026-07-17T08:00:00Z', type: 'music_show' },
    ]
    const paris = groupEventsByEventDay(events, 'Europe/Paris')
    expect(paris.get('2026-07-17')?.map((e) => e.id)).toEqual(['bday', 'show'])
    expect(paris.get('2026-07-16')).toBeUndefined()
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

describe('kstDayBounds', () => {
  it('encadre le jour KST contenant l’instant (UTC [from, to))', () => {
    // 06:15Z le 11/07 = 15:15 KST → jour KST 2026-07-11 = [10/07 15:00Z, 11/07 15:00Z)
    expect(kstDayBounds('2026-07-11T06:15:00Z')).toEqual({
      from: '2026-07-10T15:00:00.000Z',
      to: '2026-07-11T15:00:00.000Z',
    })
    // 16:00Z = déjà le lendemain en KST
    expect(kstDayBounds('2026-07-11T16:00:00Z').from).toBe('2026-07-11T15:00:00.000Z')
  })
})
