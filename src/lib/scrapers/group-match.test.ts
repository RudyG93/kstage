import { describe, it, expect } from 'vitest'
import { normalize, matchesGroup, withinOneEdit } from './group-match'

describe('normalize', () => {
  it('lowercase + strip ponctuation/espaces', () => {
    expect(normalize('aespa - Whiplash (Official M/V)')).toBe('aespawhiplashofficialmv')
  })

  it('plie les accents — é précomposé et é décomposé donnent la même clé (APT., 2026-07-13)', () => {
    // La chaîne de ROSÉ titre avec un é DÉCOMPOSÉ (e + U+0301, style macOS).
    expect(normalize('Rosé')).toBe('rose')
    expect(normalize('Rosé')).toBe('rose')
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

  it('ignore le crédit de featuring entre parenthèses (anti-misattribution)', () => {
    // Le MV est de LE SSERAFIM, pas de BTS : « of BTS » est dans le crédit invité.
    const title = "LE SSERAFIM (르세라핌) 'SPAGHETTI (feat. j-hope of BTS)' OFFICIAL MV"
    expect(matchesGroup(title, 'BTS')).toBe(false)
    expect(matchesGroup(title, 'Le Sserafim')).toBe(true)
    // Une parenthèse non-featuring (nom hangul) reste prise en compte.
    expect(matchesGroup('Karina (aespa) - solo stage', 'aespa')).toBe(true)
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

describe('stripHashtags (garde cross-artiste, audit prod 2026-07-03)', () => {
  it("n'attribue pas un MV d'un autre artiste via un hashtag de label", () => {
    // Titre réel : MV de UAU sur la chaîne Dreamcatcher Company, attribué à
    // Dreamcatcher par « #Dreamcatcher_UAU » avant le fix.
    const title =
      "유아유(UAU) 'GENE' MV #유아유 #UAU #Dreamcatcher_UAU #2nd_Mini_Album #Playlist #Your_Youth #GENE"
    expect(matchesGroup(title, 'Dreamcatcher')).toBe(false)
    expect(matchesGroup(title, 'UAU')).toBe(true)
  })

  it('matche toujours un groupe présent dans le titre éditorial', () => {
    expect(matchesGroup("aespa 에스파 'Whiplash' MV #aespa #Whiplash", 'aespa')).toBe(true)
    expect(matchesGroup("Dreamcatcher(드림캐쳐) 'JUSTICE' MV", 'Dreamcatcher')).toBe(true)
  })
})

describe('repli hashtag exact (chaînes officielles qui titrent en hashtag)', () => {
  it('accepte un hashtag strictement égal au nom du groupe', () => {
    expect(matchesGroup("#ENHYPEN (#엔하이픈) 'Knife' Official MV", 'ENHYPEN')).toBe(true)
    expect(matchesGroup("#Loossemble (루셈블) 'Girls' Night' MV", 'Loossemble')).toBe(true)
  })

  it("rejette un hashtag composé contenant le nom (tag maison d'un autre artiste)", () => {
    expect(
      matchesGroup("유아유(UAU) 'GENE' MV #유아유 #UAU #Dreamcatcher_UAU", 'Dreamcatcher'),
    ).toBe(false)
  })
})

describe('withinOneEdit', () => {
  it('typo réelle du carrd : Heart2Hearts ↔ Hearts2Hearts (1 insertion)', () => {
    expect(withinOneEdit('heart2hearts', 'hearts2hearts')).toBe(true)
  })
  it('égalité et substitution unique', () => {
    expect(withinOneEdit('babymonster', 'babymonster')).toBe(true)
    expect(withinOneEdit('babymonster', 'babymonstar')).toBe(true)
  })
  it('rejette au-delà d’une édition', () => {
    expect(withinOneEdit('hearts2hearts', 'heart2heart')).toBe(false)
    expect(withinOneEdit('ateez', 'aespa')).toBe(false)
  })
})
