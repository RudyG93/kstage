import { describe, expect, it } from 'vitest'
import { mvKindForSecondary, songTitleKey } from './song-key'

// Titres RÉELS (chaînes officielles, vérifiés le 2026-08-21).
describe('songTitleKey', () => {
  it('extrait la chanson entre guillemets simples', () => {
    expect(songTitleKey("KISS OF LIFE (키스오브라이프) 'Bad News' Official Music Video")).toBe(
      'badnews',
    )
  })
  it('rapproche le MV et son Performance Video', () => {
    const mv = songTitleKey("KISS OF LIFE (키스오브라이프) 'Bad News' Official Music Video")
    const pv = songTitleKey("KISS OF LIFE (키스오브라이프) 'Bad News' Performance Video")
    expect(pv).toBe(mv)
  })
  it('ignore les suffixes de déclinaison (Side A/B)', () => {
    const a = songTitleKey('OURBIRTHDAY “HUNGRY (Side A)” Performance Video')
    const b = songTitleKey('OURBIRTHDAY “HUNGRY (Side B)” Performance Video')
    expect(a).toBe('hungry')
    expect(b).toBe('hungry')
  })
  it('distingue deux chansons différentes', () => {
    expect(songTitleKey("KISS OF LIFE 'Painting' Special Video")).not.toBe(
      songTitleKey("KISS OF LIFE 'Bad News' Official Music Video"),
    )
  })
})

describe('mvKindForSecondary', () => {
  const known = new Set(['badnews', 'getloud'])
  it('performance quand la chanson a déjà un vrai MV', () => {
    expect(mvKindForSecondary('badnews', known)).toBe('performance')
  })
  it('main quand la chanson n’a aucun MV (seul clip officiel)', () => {
    expect(mvKindForSecondary('painting', known)).toBe('main')
    expect(mvKindForSecondary('hungry', known)).toBe('main')
  })
})
