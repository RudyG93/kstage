import { describe, it, expect } from 'vitest'
import { detectEventType } from './youtube'

describe('detectEventType', () => {
  it('détecte mv', () => {
    expect(detectEventType("aespa 'Whiplash' MV", '')).toBe('mv')
    expect(detectEventType('LE SSERAFIM CRAZY Official Video', '')).toBe('mv')
  })

  it('détecte release', () => {
    expect(detectEventType('aespa - Mini Album', '')).toBe('release')
    expect(detectEventType('ILLIT 2nd Single', '')).toBe('release')
  })

  it('détecte concert', () => {
    expect(detectEventType('World Tour 2026', 'concert details')).toBe('concert')
  })

  it('détecte music_show', () => {
    expect(detectEventType('M Countdown performance', '')).toBe('music_show')
    expect(detectEventType('Inkigayo stage', '')).toBe('music_show')
  })

  it('détecte anniversary', () => {
    expect(detectEventType('Debut Anniversary', '')).toBe('anniversary')
  })

  it('détecte live', () => {
    expect(detectEventType('Weverse Live', '')).toBe('live')
    expect(detectEventType('V Live special', '')).toBe('live')
  })

  it('retourne other par défaut', () => {
    expect(detectEventType('Random video title', 'no keywords')).toBe('other')
  })

  // Derivatives d'un MV : doivent NE PAS être classés en 'mv' (sinon /mv/[slug]
  // se remplit de teasers et behind-the-scenes au lieu des vrais clips).
  describe('exclut les derivatives MV', () => {
    it("teaser n'est pas un MV", () => {
      expect(detectEventType("aespa 'LEMONADE' MV Teaser", '')).toBe('other')
    })

    it("behind the scenes n'est pas un MV", () => {
      expect(
        detectEventType(
          "[R(ae)cord] aespa 'WDA (Whole Different Animal)' MV Behind The Scenes",
          '',
        ),
      ).toBe('other')
    })

    it("making of n'est pas un MV", () => {
      expect(
        detectEventType("YG PRODUCTION EP.1 The Making of BABYMONSTER's 'SHEESH' DOCUMENTARY", ''),
      ).toBe('other')
    })

    it("dance practice n'est pas un MV", () => {
      expect(detectEventType("aespa 'WDA (Whole Different Animal)' Dance Practice", '')).toBe(
        'other',
      )
    })

    it("performance video n'est pas un MV", () => {
      expect(detectEventType("aespa 'WDA (Whole Different Animal)' Performance Video", '')).toBe(
        'other',
      )
    })

    it("highlight medley n'est pas un release scrapable", () => {
      expect(detectEventType("aespa 'LEMONADE' Highlight Medley", '')).toBe('other')
    })

    it("recording behind n'est pas un release", () => {
      expect(detectEventType("aespa 'WDA' Recording Behind The Scenes", '')).toBe('other')
    })

    it("episode/vlog/replay n'est pas un live", () => {
      expect(detectEventType("ILLIT 'SUPER ILLIT' EP.8", '')).toBe('other')
      expect(detectEventType('[Replay] aespa Countdown Live', '')).toBe('other')
    })

    it('un vrai MV "Official MV" reste classé mv', () => {
      expect(detectEventType("aespa 'Whiplash' Official MV", '')).toBe('mv')
      expect(detectEventType("(G)I-DLE 'Klaxon' Official Music Video", '')).toBe('mv')
    })
  })
})
