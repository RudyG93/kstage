import { describe, it, expect } from 'vitest'
import { displayEventTitle, displaySongTitle } from './title'

describe('displayEventTitle', () => {
  it('retire le préfixe groupe + année + normalise Part.N (cas avec hyphen)', () => {
    expect(displayEventTitle('ATEEZ Album - Golden Hour : Part.5 (2026)', 'ATEEZ')).toBe(
      'Golden Hour : Part 5',
    )
  })

  it('retire le préfixe groupe avec en-dash U+2013 (séparateur kpopofficial)', () => {
    // Titre exactement comme stocké en prod (events.title hex confirmé = …e28093…).
    expect(displayEventTitle('ATEEZ Album – GOLDEN HOUR : Part.5 (2026)', 'ATEEZ')).toBe(
      'GOLDEN HOUR : Part 5',
    )
    expect(displayEventTitle('aespa 2nd Album – LEMONADE (2026)', 'aespa')).toBe('LEMONADE')
  })

  it("suffixe le numéro d'épisode (music show)", () => {
    expect(displayEventTitle('Inkigayo', 'aespa', 328)).toBe('Inkigayo #328')
    // pas de suffixe quand episodeNumber est null/undefined
    expect(displayEventTitle('Inkigayo', 'aespa', null)).toBe('Inkigayo')
    expect(displayEventTitle('Inkigayo', 'aespa')).toBe('Inkigayo')
  })

  it('strip simple : "aespa - Whiplash MV" → "Whiplash MV"', () => {
    expect(displayEventTitle('aespa - Whiplash MV', 'aespa')).toBe('Whiplash MV')
  })

  it('gère les caractères spéciaux dans le nom de groupe ((G)I-DLE)', () => {
    expect(displayEventTitle('(G)I-DLE - Super Lady MV (2024)', '(G)I-DLE')).toBe('Super Lady MV')
  })

  it('ne touche pas un titre déjà propre', () => {
    expect(displayEventTitle('Golden Hour', 'ATEEZ')).toBe('Golden Hour')
  })

  it('no-op si pas de groupName fourni mais normalise quand même année + Part.N', () => {
    expect(displayEventTitle('Golden Hour : Part.5 (2026)')).toBe('Golden Hour : Part 5')
  })

  it('limite connue : le pattern .N normalise aussi v2.0 → v2 0 (acceptable, Part.N domine côté YT)', () => {
    expect(displayEventTitle('Album v2.0 release', 'IVE')).toBe('Album v2 0 release')
  })
})

describe('displaySongTitle', () => {
  // Priorité 1 : extraction entre quotes (greedy)
  it('apostrophe straight outer + apostrophe straight possessive interne (cas ILLIT prod réel)', () => {
    // Critique : la regex doit être greedy pour ne pas s'arrêter au "It's" interne.
    expect(displaySongTitle("ILLIT (아일릿) 'It's Me' Official MV")).toBe("It's Me")
    expect(displaySongTitle("ILLIT (아일릿) 'It's Me' Official MV (MOKA ver.)")).toBe("It's Me")
  })

  it('quotes straight greedy : WDA (Feat. G-DRAGON) reste complet', () => {
    expect(
      displaySongTitle("aespa 에스파 'WDA (Whole Different Animal) (Feat. G-DRAGON)' MV"),
    ).toBe('WDA (Whole Different Animal) (Feat. G-DRAGON)')
  })

  it('chanson hangul avec parens, groupe en hangul aussi : strip groupe, garde chanson', () => {
    expect(
      displaySongTitle("(여자)아이들((G)I-DLE) - '클락션 (Klaxon)' Official Music Video"),
    ).toBe('클락션 (Klaxon)')
  })

  it('chanson hangul simple', () => {
    expect(displaySongTitle("BABYMONSTER - '춤 (CHOOM)' M/V")).toBe('춤 (CHOOM)')
  })

  it('chanson mono-mot', () => {
    expect(displaySongTitle("aespa 'Whiplash' Official MV")).toBe('Whiplash')
  })

  it('curly quotes ‘ ’ (priorité 1, avant straight)', () => {
    expect(displaySongTitle('aespa ‘Drama’ Official MV')).toBe('Drama')
  })

  // Priorité 2 : fallback (strip groupName + (hangul) + trailing MV)
  it("fallback sans quotes : strip 'ILLIT' au début + 'Official Music Video' à la fin", () => {
    expect(displaySongTitle('ILLIT Magnetic Official Music Video', 'ILLIT')).toBe('Magnetic')
  })

  it("fallback sans quotes : strip 'ILLIT (아일릿) ' (hangul entre parens)", () => {
    expect(displaySongTitle('ILLIT (아일릿) Magnetic MV', 'ILLIT')).toBe('Magnetic')
  })

  it("fallback sans quotes : strip 'aespa (에스파) ' (hangul entre parens, autre groupe)", () => {
    expect(displaySongTitle('aespa (에스파) WDA Official MV', 'aespa')).toBe('WDA')
  })

  it('pas de quotes ni MV suffix : retourne le titre nettoyé', () => {
    expect(displaySongTitle('Just a title', null)).toBe('Just a title')
  })

  it('titre vide → vide', () => {
    expect(displaySongTitle('', null)).toBe('')
  })

  it("fallback avec séparateur classique : '-' fonctionne comme displayEventTitle", () => {
    expect(displaySongTitle('aespa - Hot Mess Official MV', 'aespa')).toBe('Hot Mess')
  })
})

describe('displayEventTitle — releases kpopofficial (fix 2026-07-12)', () => {
  it('prend le segment après le dernier en-dash (cas réel Crow)', () => {
    expect(
      displayEventTitle('i-dle Pre-release Single – Crow (2026)', 'i-dle', null, 'release'),
    ).toBe('Crow')
    expect(
      displayEventTitle('i-dle 9th Mini Album – We made (2026)', 'i-dle', null, 'release'),
    ).toBe('We made')
    expect(
      displayEventTitle(
        'aespa 1st Japan Mini Album – KISS N TELL (2026)',
        'aespa',
        null,
        'release',
      ),
    ).toBe('KISS N TELL')
  })
  it('titres sans en-dash intacts (année strippée)', () => {
    expect(displayEventTitle('Mark on Me', '&TEAM', null, 'release')).toBe('Mark on Me')
    // Descripteur sans nom de sortie : on garde tel quel (rien à extraire).
    expect(displayEventTitle('NCT 127 7th Full Album (2026)', 'NCT 127', null, 'release')).toBe(
      'NCT 127 7th Full Album',
    )
  })
  it('multi en-dash : dernier segment (cas KARD NOWHERE)', () => {
    expect(
      displayEventTitle(
        'KARD 1st Album – Where To Now? (Part.2) : NOWHERE (2026)',
        'KARD',
        null,
        'release',
      ),
    ).toBe('Where To Now? (Part 2) : NOWHERE')
  })
  it('hors release : comportement inchangé', () => {
    expect(displayEventTitle('ATEEZ Album - Golden Hour', 'ATEEZ', null, 'mv')).toBe('Golden Hour')
  })
})

describe('displaySongTitle — classes du balayage R6 (168 titres prod mal rendus)', () => {
  it('tiret orphelin après strip du groupe (EPEX en-dash sans quotes)', () => {
    expect(displaySongTitle('EPEX(이펙스) – ECHO M/V', 'EPEX')).toBe('ECHO')
  })
  it('quotes mixtes curly-ouvrante / straight-fermante (NAVILLERA)', () => {
    expect(
      displaySongTitle("NAVILLERA(나빌레라) - ‘Friday Night' Official Music Video", 'NAVILLERA'),
    ).toBe('Friday Night')
  })
  it('tag [MV] + nom coréen en premier (Starship/Highlight)', () => {
    expect(
      displaySongTitle('[MV] 하이라이트(Highlight) - CALLING YOU Smile ver.', 'Highlight'),
    ).toBe('CALLING YOU Smile ver.')
  })
  it('tag (MV) + underscore sans espaces (WM/ONF)', () => {
    expect(displaySongTitle('(MV)온앤오프 (ONF)_Your Song', 'ONF')).toBe('Your Song')
  })
  it('doubles courbes JYP (ITZY)', () => {
    expect(displaySongTitle('ITZY “LOCO” M/V @ITZY', 'ITZY')).toBe('LOCO')
  })
  it("chanson entre crochets DSP (KARD) — pas d'over-strip vers vide", () => {
    expect(displaySongTitle('KARD - [밤밤(Bomb Bomb)] M/V', 'KARD')).toBe('밤밤(Bomb Bomb)')
  })
  it('’ courbe fermante utilisée en ouvrante (THE BOYZ)', () => {
    expect(displaySongTitle('THE BOYZ(더보이즈) ’Nectar’ MV', 'THE BOYZ')).toBe('Nectar')
  })
})
