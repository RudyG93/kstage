import { describe, it, expect } from 'vitest'
import {
  detectEventType,
  normalizeMvTitle,
  pickStartAt,
  parseIsoDuration,
  MIN_MV_DURATION_SEC,
} from './youtube'

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

// Dédup cross-chaînes (SCRAPING.md §3.9) — titres réels relevés en prod le
// 2026-06-12 : la chaîne HYBE LABELS reposte les MV ILLIT avec un préfixe «#».
describe('normalizeMvTitle', () => {
  it('variante «#» de HYBE LABELS = même titre normalisé (paires prod réelles)', () => {
    expect(normalizeMvTitle('#ILLIT (#아일릿) ‘Tick-Tack’ Official MV')).toBe(
      normalizeMvTitle('ILLIT (아일릿) ‘Tick-Tack’ Official MV'),
    )
    expect(normalizeMvTitle("#ILLIT (#아일릿) 'jellyous’ Official MV")).toBe(
      normalizeMvTitle("ILLIT (아일릿) 'jellyous’ Official MV"),
    )
    expect(normalizeMvTitle('#ILLIT (#아일릿) ‘Cherish (My Love)’ Official MV')).toBe(
      normalizeMvTitle('ILLIT (아일릿) ‘Cherish (My Love)’ Official MV'),
    )
  })

  it('égalité stricte : une version officielle distincte ne matche PAS', () => {
    // « æ-aespa Ver. » (2023-10-06) est un event légitime distinct du MV
    // principal (2023-08-18) — détecté en prod, à ne jamais dédupliquer.
    expect(normalizeMvTitle("aespa 에스파 'Better Things' MV")).not.toBe(
      normalizeMvTitle("aespa 에스파 'Better Things' MV (æ-aespa Ver.)"),
    )
  })

  it('« OUT NOW » ne se normalise pas vers le titre du MV (géré par le gate strict)', () => {
    expect(normalizeMvTitle('‘SUGAR HONEY ICE TEA’ M/V OUT NOW')).not.toBe(
      normalizeMvTitle("BABYMONSTER - 'SUGAR HONEY ICE TEA' M/V"),
    )
  })

  it('insensible à la casse, ponctuation, espaces et quotes typographiques', () => {
    expect(normalizeMvTitle("ILLIT  'TICK-TACK'   official mv")).toBe(
      normalizeMvTitle('illit ‘Tick-Tack’ Official MV'),
    )
  })
})

// P0.4 : une premiere programmée est un event FUTUR daté à scheduledStartTime ;
// une vidéo publiée garde sa date de publication.
describe('pickStartAt', () => {
  const published = '2026-06-01T08:00:00Z'
  const scheduled = '2026-06-20T09:00:00Z'

  it('premiere programmée (upcoming) → scheduledStartTime', () => {
    expect(
      pickStartAt(
        { liveBroadcastContent: 'upcoming', scheduledStartTime: scheduled, durationSec: null },
        published,
      ),
    ).toBe(scheduled)
  })

  it('premiere en cours (live) → scheduledStartTime', () => {
    expect(
      pickStartAt(
        { liveBroadcastContent: 'live', scheduledStartTime: scheduled, durationSec: null },
        published,
      ),
    ).toBe(scheduled)
  })

  it('vidéo publiée (none) → publishedAt, même si scheduledStartTime traîne', () => {
    expect(
      pickStartAt(
        { liveBroadcastContent: 'none', scheduledStartTime: scheduled, durationSec: null },
        published,
      ),
    ).toBe(published)
  })

  it('upcoming sans scheduledStartTime → fallback publishedAt', () => {
    expect(
      pickStartAt(
        { liveBroadcastContent: 'upcoming', scheduledStartTime: null, durationSec: null },
        published,
      ),
    ).toBe(published)
  })

  it('détails absents (videos.list incomplet) → publishedAt', () => {
    expect(pickStartAt(undefined, published)).toBe(published)
  })
})

describe('parseIsoDuration (gate durée, audit prod 2026-07-03)', () => {
  it('parse les formats YouTube courants', () => {
    expect(parseIsoDuration('PT30S')).toBe(30)
    expect(parseIsoDuration('PT3M12S')).toBe(192)
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723)
    expect(parseIsoDuration('PT4M')).toBe(240)
  })

  it('renvoie null pour une premiere pas encore diffusée ou un format illisible', () => {
    expect(parseIsoDuration('P0D')).toBe(null)
    expect(parseIsoDuration('')).toBe(null)
    expect(parseIsoDuration(null)).toBe(null)
    expect(parseIsoDuration(undefined)).toBe(null)
    expect(parseIsoDuration('garbage')).toBe(null)
  })

  it('le seuil MV rejette les teasers et garde les clips', () => {
    expect(parseIsoDuration('PT30S')! < MIN_MV_DURATION_SEC).toBe(true) // teaser 30 s
    expect(parseIsoDuration('PT1M10S')! < MIN_MV_DURATION_SEC).toBe(true) // extrait 70 s
    expect(parseIsoDuration('PT2M55S')! >= MIN_MV_DURATION_SEC).toBe(true) // vrai MV
  })
})

describe('detectEventType — dérivés sur le titre seul (fix 2026-07-11)', () => {
  it("n'écarte pas un MV dont la DESCRIPTION contient un terme dérivé (tracklist)", () => {
    // Faux négatif réel : Lemon Tang (SMTOWN) — la piste 05 s'appelle
    // « Secret Recipe » et \brecipe\b rejetait tout le MV en 'other'.
    const desc =
      'Hearts2Hearts\' 2nd mini album "Lemon Tang" is out!\n[Tracklist]\n01 Lemon Tang\n05 Secret Recipe\n06 RUDE!'
    expect(detectEventType("Hearts2Hearts 하츠투하츠 'Lemon Tang' MV", desc)).toBe('mv')
  })
  it('écarte toujours les dérivés titrés comme tels', () => {
    expect(detectEventType("Hearts2Hearts 'Lemon Tang' MV Teaser", '')).toBe('other')
    expect(detectEventType("aespa 'Whiplash' Dance Practice", '')).toBe('other')
  })
})
