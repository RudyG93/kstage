import { describe, it, expect } from 'vitest'
import { pickTrending, trendingReason, trendingScore } from './trending'

const NOW = Date.parse('2026-07-11T12:00:00Z')
const days = (n: number) => new Date(NOW + n * 86_400_000).toISOString()

const sig = (type: string, start_at: string, title = 'x') => ({ type, start_at, title })

describe('trendingScore', () => {
  it('comeback imminent (D-1) > sortie récente (3 j)', () => {
    const imminent = trendingScore(sig('release', days(1)), undefined, NOW)
    const recent = trendingScore(undefined, sig('mv', days(-3)), NOW)
    expect(imminent).toBeGreaterThan(recent)
    expect(recent).toBeGreaterThan(0)
  })
  it('event au-delà de l’horizon 45 j et sortie au-delà de 30 j → 0', () => {
    expect(trendingScore(sig('release', days(60)), undefined, NOW)).toBe(0)
    expect(trendingScore(undefined, sig('mv', days(-40)), NOW)).toBe(0)
  })
})

describe('trendingReason', () => {
  it('event futur prioritaire, wording par type', () => {
    expect(trendingReason(sig('release', days(3)), sig('mv', days(-2)), NOW)).toMatch(
      /^Comeback · D-/,
    )
    expect(trendingReason(sig('music_show', days(2)), undefined, NOW)).toMatch(/^Music show · D-/)
  })
  it('sinon la sortie récente', () => {
    expect(trendingReason(undefined, sig('mv', days(-3)), NOW)).toMatch(/^MV out · /)
    expect(trendingReason(undefined, sig('release', days(-3)), NOW)).toMatch(/^Release · /)
  })
})

describe('pickTrending', () => {
  const items = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
    { id: 'c', name: 'Calme' }, // aucun signal → hors pool
  ]
  it('classe par score, exclut les sans-signal, renvoie la raison', () => {
    const next = new Map([['a', sig('release', days(2))]])
    const recent = new Map([['b', sig('mv', days(-5))]])
    const out = pickTrending(items, next, recent, () => 0, 5, NOW)
    expect(out.map((e) => e.item.id)).toEqual(['a', 'b'])
    expect(out[0].reason).toMatch(/^Comeback/)
    expect(out[1].reason).toMatch(/^MV out/)
  })
  it('départage par follows à score égal', () => {
    const recent = new Map([
      ['a', sig('mv', days(-5))],
      ['b', sig('mv', days(-5))],
    ])
    const out = pickTrending(items, new Map(), recent, (id) => (id === 'b' ? 3 : 1), 5, NOW)
    expect(out.map((e) => e.item.id)).toEqual(['b', 'a'])
  })
})
