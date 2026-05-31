import { describe, it, expect } from 'vitest'
import { splitUpcomingByWeek, splitUpcomingByBuckets, capLaterEvents } from './grouping'
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

describe('splitUpcomingByBuckets', () => {
  // 2026-06-01T00:00:00Z = 2026-06-01T09:00:00 KST
  // kstDayKey(now) = '2026-06-01'
  const now = new Date('2026-06-01T00:00:00Z').getTime()

  it('liste vide → 4 buckets vides', () => {
    expect(splitUpcomingByBuckets([], now)).toEqual({
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
    })
  })

  it("event à 23h KST aujourd'hui reste dans today (pas tomorrow)", () => {
    // 2026-06-01T14:00:00Z = 2026-06-01T23:00:00 KST
    const events = [ev('a', '2026-06-01T14:00:00Z')]
    const { today, tomorrow } = splitUpcomingByBuckets(events, now)
    expect(today.map((e) => e.id)).toEqual(['a'])
    expect(tomorrow).toEqual([])
  })

  it('event J+1 KST classé dans tomorrow', () => {
    // 2026-06-02T03:00:00Z = 2026-06-02T12:00:00 KST → tomorrow
    const events = [ev('a', '2026-06-02T03:00:00Z')]
    const { tomorrow } = splitUpcomingByBuckets(events, now)
    expect(tomorrow.map((e) => e.id)).toEqual(['a'])
  })

  it('events J+2 à J+7 KST dans thisWeek (J+7 inclus)', () => {
    const events = [
      ev('a', '2026-06-03T05:00:00Z'), // 2026-06-03 14:00 KST
      ev('b', '2026-06-08T14:00:00Z'), // 2026-06-08 23:00 KST → kstDayKey = 2026-06-08, weekEndKey = 2026-06-08
    ]
    const { thisWeek } = splitUpcomingByBuckets(events, now)
    expect(thisWeek.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('event J+8 KST classé dans later', () => {
    // 2026-06-09T14:00:00Z = 2026-06-09 23:00 KST → later
    const events = [ev('a', '2026-06-09T14:00:00Z')]
    const { later } = splitUpcomingByBuckets(events, now)
    expect(later.map((e) => e.id)).toEqual(['a'])
  })

  it('mix complet réparti correctement', () => {
    const events = [
      ev('today1', '2026-06-01T05:00:00Z'), // today
      ev('today2', '2026-06-01T14:00:00Z'), // today
      ev('tom', '2026-06-02T10:00:00Z'), // tomorrow
      ev('week1', '2026-06-04T10:00:00Z'), // this week
      ev('week2', '2026-06-08T10:00:00Z'), // this week (limit J+7)
      ev('later1', '2026-06-20T10:00:00Z'), // later
    ]
    const { today, tomorrow, thisWeek, later } = splitUpcomingByBuckets(events, now)
    expect(today.map((e) => e.id)).toEqual(['today1', 'today2'])
    expect(tomorrow.map((e) => e.id)).toEqual(['tom'])
    expect(thisWeek.map((e) => e.id)).toEqual(['week1', 'week2'])
    expect(later.map((e) => e.id)).toEqual(['later1'])
  })
})

describe('capLaterEvents (§3.1)', () => {
  const now = new Date('2026-06-01T00:00:00Z').getTime() // limite ≈ 2026-07-02

  it('borne à ≤10 events dans le mois et compte le reste', () => {
    const within = Array.from({ length: 12 }, (_, i) =>
      ev(`w${i}`, `2026-06-${String(i + 2).padStart(2, '0')}T03:00:00Z`),
    ) // 2..13 juin, tous dans le mois
    const beyond = [ev('b1', '2026-08-01T03:00:00Z')] // > 1 mois
    const { display, moreCount, moreHref } = capLaterEvents(
      [...within, ...beyond],
      now,
      'Asia/Seoul',
    )
    expect(display).toHaveLength(10)
    expect(moreCount).toBe(3) // 13 total - 10 affichés
    expect(moreHref).toMatch(/^\/calendar\?month=\d{4}-\d{2}&day=\d{4}-\d{2}-\d{2}$/)
  })

  it('exclut les events au-delà d’1 mois du display', () => {
    const { display, moreCount } = capLaterEvents([ev('b', '2026-08-01T03:00:00Z')], now)
    expect(display).toEqual([])
    expect(moreCount).toBe(1)
  })

  it('liste vide → display vide, pas de lien', () => {
    expect(capLaterEvents([], 0)).toEqual({ display: [], moreCount: 0, moreHref: null })
  })
})

describe('splitUpcomingByBuckets — fuseau utilisateur (§1.3)', () => {
  // now = 2026-05-30T15:00:00Z
  //   Europe/Paris (UTC+2, CEST) → 17:00 le 30 mai → today = 2026-05-30
  //   Asia/Seoul   (UTC+9)       → 00:00 le 31 mai → today = 2026-05-31
  const now = new Date('2026-05-30T15:00:00Z').getTime()
  // event = 2026-05-31T13:00:00Z
  //   Paris → 15:00 le 31 mai → J+1 pour l'utilisateur parisien (tomorrow)
  //   Seoul → 22:00 le 31 mai → même jour que `now` en KST
  const event = ev('e', '2026-05-31T13:00:00Z')

  it('classe en tomorrow dans le fuseau de l’utilisateur (Europe/Paris)', () => {
    const { today, tomorrow } = splitUpcomingByBuckets([event], now, 'Europe/Paris')
    expect(today).toEqual([])
    expect(tomorrow.map((e) => e.id)).toEqual(['e'])
  })

  it('reproduit le bug historique : en KST le même event tombe à tort dans today', () => {
    const { today } = splitUpcomingByBuckets([event], now, 'Asia/Seoul')
    expect(today.map((e) => e.id)).toEqual(['e'])
  })

  it('fuseau par défaut = Asia/Seoul (compat ascendante)', () => {
    expect(splitUpcomingByBuckets([event], now)).toEqual(
      splitUpcomingByBuckets([event], now, 'Asia/Seoul'),
    )
  })
})
