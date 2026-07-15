import { describe, expect, it } from 'vitest'
import { findHeroEventIndex } from './hero'

describe('findHeroEventIndex', () => {
  it.each(['mv', 'release', 'music_show'] as const)('accepts %s as a hero event', (type) => {
    expect(findHeroEventIndex([{ type }])).toBe(0)
  })

  it('skips live and anniversary rows in favor of the next real comeback', () => {
    expect(
      findHeroEventIndex([{ type: 'live' }, { type: 'anniversary' }, { type: 'release' }]),
    ).toBe(2)
  })

  it('returns -1 when every event is outside hero scope', () => {
    expect(
      findHeroEventIndex([
        { type: 'live' },
        { type: 'anniversary' },
        { type: 'concert' },
        { type: 'other' },
      ]),
    ).toBe(-1)
  })
})
