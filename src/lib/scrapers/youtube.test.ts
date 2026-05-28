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

  it('"Debut Anniversary" ne renvoie plus anniversary (généré à la volée)', () => {
    // Anniversaries calculés via src/lib/events/anniversaries.ts ; le scraper
    // ne doit pas en produire. "Debut" comme keyword captait BABYMONSTER
    // "PRE-DEBUT SONG" / "DEBUT MEMBER ANNOUNCEMENT" en faux positifs.
    expect(detectEventType('Debut Anniversary', '')).toBe('other')
    expect(detectEventType("BABYMONSTER - 'DREAM' (PRE-DEBUT SONG)", '')).toBe('other')
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

    // Markers hangul ajoutés après audit MCP : voir docs/SCRAPING.md §3.6
    describe('markers hangul (audit prod 2026-05-28)', () => {
      it('비하인드 (behind) → other', () => {
        expect(
          detectEventType(
            "(여자)아이들((G)I-DLE) - I-TALK #36 : 'Uh-Oh' M/V 촬영 비하인드 (Part 1)",
            '',
          ),
        ).toBe('other')
      })

      it('리액션 (reaction) → other (mix EN/KR aussi)', () => {
        expect(
          detectEventType(
            "쉬는 시간에 Cherish (My Love) 뮤비 리액션은 못 참지 | ILLIT 'Cherish (My Love)' MV Reaction",
            '',
          ),
        ).toBe('other')
      })

      it('현장 비하인드 (on-site behind) → other', () => {
        expect(
          detectEventType(
            "전소연(JEON SOYEON) - '아이들 쏭(Idle song)' M/V 촬영 현장 비하인드",
            '',
          ),
        ).toBe('other')
      })

      it('티저 (teaser) hangul → other', () => {
        expect(detectEventType("aespa 'Supernova' MV 티저", '')).toBe('other')
      })

      it('메이킹 (making) hangul → other', () => {
        expect(detectEventType("aespa 'Drama' MV 메이킹", '')).toBe('other')
      })

      it('Reaction EN seul → other', () => {
        expect(detectEventType('aespa Whiplash MV Reaction', '')).toBe('other')
      })

      it('Highlight Clip EN → other (différent de highlight medley)', () => {
        expect(detectEventType("BABYMONSTER - 'CHOOM' M/V HIGHLIGHT CLIP", '')).toBe('other')
      })
    })
  })
})
