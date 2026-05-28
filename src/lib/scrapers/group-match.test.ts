import { describe, it, expect } from 'vitest'
import { normalize, matchesGroup } from './group-match'

describe('normalize', () => {
  it('lowercase + strip ponctuation/espaces', () => {
    expect(normalize('aespa - Whiplash (Official M/V)')).toBe('aespawhiplashofficialmv')
  })

  it('garde les caractères Unicode (hangul)', () => {
    expect(normalize('에스파')).toBe('에스파')
  })

  it('chaîne vide → vide', () => {
    expect(normalize('')).toBe('')
    expect(normalize('---')).toBe('')
  })
})

describe('matchesGroup', () => {
  it('aespa : variantes courantes', () => {
    expect(matchesGroup("aespa 'Whiplash' MV", 'aespa')).toBe(true)
    expect(matchesGroup('AESPA - Whiplash', 'aespa')).toBe(true)
    expect(matchesGroup('Karina (aespa) - solo stage', 'aespa')).toBe(true)
    expect(matchesGroup("SMTOWN | aespa 에스파 'Supernova' MV", 'aespa')).toBe(true)
  })

  it('aespa NE match PAS un MV BABYMONSTER (même agence YG, sans rapport)', () => {
    expect(matchesGroup('BABYMONSTER - DRIP M/V', 'aespa')).toBe(false)
  })

  it('i-dle (group.name réel en DB) : "idle" est inclus dans "gidle"', () => {
    // normalize("i-dle") = "idle", normalize("(G)I-DLE 'Klaxon' MV") = "gidleklaxonmv"
    // → "gidleklaxonmv".includes("idle") = true car "g[idle]klaxonmv".
    expect(matchesGroup("(G)I-DLE 'Klaxon' Official MV", 'i-dle')).toBe(true)
    expect(matchesGroup('IDLE - Tomboy', 'i-dle')).toBe(true)
    expect(matchesGroup("(여자)아이들 - 'Klaxon' Official Music Video", 'i-dle')).toBe(false)
    // un MV d'un autre groupe ne mentionne pas "idle"
    expect(matchesGroup('aespa Whiplash MV', 'i-dle')).toBe(false)
  })

  it('BABYMONSTER : variantes case + hangul en parenthèses', () => {
    expect(matchesGroup("BABYMONSTER (베이비몬스터) 'DRIP' M/V", 'BABYMONSTER')).toBe(true)
    expect(matchesGroup("babymonster 'BATTER UP' M/V", 'BABYMONSTER')).toBe(true)
  })

  it('ILLIT : tolère le nom dans la description plutôt que le titre', () => {
    expect(matchesGroup("'Magnetic' M/V — first single from ILLIT", 'ILLIT')).toBe(true)
  })

  it('groupName falsy → false (anti-faux-positif)', () => {
    expect(matchesGroup('aespa Whiplash MV', '')).toBe(false)
    expect(matchesGroup('aespa Whiplash MV', null)).toBe(false)
    expect(matchesGroup('aespa Whiplash MV', undefined)).toBe(false)
  })

  it('groupName qui normalise en vide → false', () => {
    expect(matchesGroup('aespa Whiplash MV', '---')).toBe(false)
    expect(matchesGroup('aespa Whiplash MV', '   ')).toBe(false)
  })
})
