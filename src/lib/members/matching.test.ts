import { describe, expect, it } from 'vitest'
import { findCanonicalMatch, type PersonEvidence } from './matching'

const person = (over: Partial<PersonEvidence> & Pick<PersonEvidence, 'id' | 'group_id'>) => ({
  stage_name: 'X',
  real_name: null,
  birthday: null,
  canonical_id: null,
  ...over,
})

describe('findCanonicalMatch', () => {
  const dreamcatcherSua = person({
    id: 'dc',
    group_id: 'dreamcatcher',
    stage_name: 'Sua',
    real_name: 'Kim Bora',
    birthday: '1994-08-10',
  })

  it('lie le cas reel uau-sua → dreamcatcher-sua (birthday + stage name)', () => {
    const uauSua = person({
      id: 'uau',
      group_id: 'uau',
      stage_name: 'SuA',
      birthday: '1994-08-10',
    })
    expect(findCanonicalMatch(uauSua, [dreamcatcherSua])).toBe('dc')
  })

  it('ne lie JAMAIS sur le stage name seul (mw-meu-sua ≠ dreamcatcher-sua)', () => {
    const mwMeuSua = person({ id: 'mw', group_id: 'mw-meu', stage_name: 'Sua' })
    expect(findCanonicalMatch(mwMeuSua, [dreamcatcherSua])).toBeNull()
  })

  it('refuse un real_name egal quand les birthdays sont en CONFLIT (homonymes coreens — cas reel NewJeans Minji ↔ Dreamcatcher JiU)', () => {
    const newjeansMinji = person({
      id: 'nj',
      group_id: 'newjeans',
      stage_name: 'Minji',
      real_name: 'Kim Minji',
      birthday: '2004-05-07',
    })
    const dreamcatcherJiu = person({
      id: 'dc-jiu',
      group_id: 'dreamcatcher',
      stage_name: 'Jiu',
      real_name: 'Kim Minji',
      birthday: '1994-05-17',
    })
    expect(findCanonicalMatch(newjeansMinji, [dreamcatcherJiu])).toBeNull()
  })

  it('lie par real_name egal meme si les stage names different', () => {
    const solo = person({
      id: 'solo',
      group_id: 'solo-grp',
      stage_name: 'BORA',
      real_name: 'Kim Bo-ra',
    })
    expect(findCanonicalMatch(solo, [dreamcatcherSua])).toBe('dc')
  })

  it('refuse un match ambigu (2 candidates)', () => {
    const other = { ...dreamcatcherSua, id: 'dc2', group_id: 'autre' }
    const uauSua = person({
      id: 'uau',
      group_id: 'uau',
      stage_name: 'SuA',
      birthday: '1994-08-10',
      real_name: 'Kim Bora',
    })
    expect(findCanonicalMatch(uauSua, [dreamcatcherSua, other])).toBeNull()
  })

  it('refuse une cible deja non-canonique (pas de chaine)', () => {
    const linked = { ...dreamcatcherSua, canonical_id: 'someone-else' }
    const uauSua = person({
      id: 'uau',
      group_id: 'uau',
      stage_name: 'SuA',
      birthday: '1994-08-10',
    })
    expect(findCanonicalMatch(uauSua, [linked])).toBeNull()
  })

  it('ignore les rows du meme groupe', () => {
    const twin = { ...dreamcatcherSua, id: 'dc-twin' }
    expect(findCanonicalMatch(twin, [dreamcatcherSua])).toBeNull()
  })
})
