import { describe, expect, it } from 'vitest'
import { personNameKeys, samePersonName, unsortPersonName } from './person-name'

// Cas RÉELS de la prod (doublons MusicBrainz constatés le 2026-08-21).
describe('unsortPersonName', () => {
  it('dé-inverse un sort-name', () => {
    expect(unsortPersonName('Park, Han-bin')).toBe('Park Han-bin')
    expect(unsortPersonName('Sakamoto, Mashiro')).toBe('Sakamoto Mashiro')
  })
  it('laisse un nom normal intact', () => {
    expect(unsortPersonName('Cho Hyejin')).toBe('Cho Hyejin')
  })
})

describe('samePersonName', () => {
  it('rapproche le stage name du sort-name MusicBrainz (EVNNE)', () => {
    expect(samePersonName('Hanbin', 'Park, Han-bin')).toBe(true)
    expect(samePersonName('Jihoo', 'Park, Ji-hoo')).toBe(true)
    expect(samePersonName('Junghyun', 'Mun, Jung-hyun')).toBe(true)
  })
  it('rapproche Mashiro / Sakamoto, Mashiro (MADEIN)', () => {
    expect(samePersonName('Mashiro', 'Sakamoto, Mashiro')).toBe(true)
  })
  it('ne rapproche PAS deux personnes distinctes du même groupe', () => {
    // NEXZ a réellement un « Yu » ET un « Yuki » ; AEN un « Haru » et « Haruto ».
    expect(samePersonName('Yu', 'Yuki')).toBe(false)
    expect(samePersonName('Haru', 'Haruto')).toBe(false)
  })
  it('ne devine pas le prénom seul hors sort-name explicite', () => {
    expect(samePersonName('Minji', 'Kim Minji')).toBe(false)
  })
})

describe('personNameKeys', () => {
  it('produit nom complet, dé-inversé et prénom pour un sort-name', () => {
    expect(personNameKeys('Park, Han-bin')).toEqual(['parkhanbin', 'hanbin'])
  })
  it('chaîne vide → aucune clé', () => {
    expect(personNameKeys('   ')).toEqual([])
  })
})
