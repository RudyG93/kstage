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

  it('chanson hangul avec glose latine : la glose est préférée (romanisation 2026-07-17)', () => {
    expect(
      displaySongTitle("(여자)아이들((G)I-DLE) - '클락션 (Klaxon)' Official Music Video"),
    ).toBe('Klaxon')
  })

  it('chanson hangul simple avec glose : la glose est préférée', () => {
    expect(displaySongTitle("BABYMONSTER - '춤 (CHOOM)' M/V")).toBe('CHOOM')
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

describe('displaySongTitle — romanisation « hangul (LATIN) » (retour Rudy 2026-07-17)', () => {
  it('cas Yena : 네모네모 (NEMONEMO) → NEMONEMO', () => {
    expect(displaySongTitle('YENA (최예나) - 네모네모 (NEMONEMO) MV', 'YENA')).toBe('NEMONEMO')
  })

  it('glose collée sans espace : 날라리(LALALAY) → LALALAY (cas Sunmi)', () => {
    expect(displaySongTitle('선미(SUNMI) - 날라리(LALALAY) Music Video', 'Sunmi')).toBe('LALALAY')
  })

  it('glose multi-mots : 놓지않을게(TEARS) → TEARS (cas Mamamoo)', () => {
    expect(displaySongTitle('[MV] 마마무(MAMAMOO) - 놓지않을게(TEARS)', 'Mamamoo')).toBe('TEARS')
  })

  it("glose dans des quotes : '중독(Overdose)' → Overdose (cas EXO)", () => {
    expect(displaySongTitle("EXO-K 엑소케이 '중독(Overdose)' MV", 'EXO')).toBe('Overdose')
  })

  it('SEVENTEEN 만세(MANSAE) → MANSAE', () => {
    expect(displaySongTitle('[M/V] SEVENTEEN(세븐틴) - 만세(MANSAE)', 'Seventeen')).toBe('MANSAE')
  })

  it('hangul SANS glose : intact (rien à préférer, cas Younha)', () => {
    expect(displaySongTitle('윤하(YOUNHA) - 포인트 니모 M/V', 'Younha')).toBe('포인트 니모')
  })

  it('un crédit (feat. …) n’est pas une glose : conservé tel quel', () => {
    expect(displaySongTitle("BLACKPINK - '마지막처럼 (feat. Nobody)' M/V", 'Blackpink')).toBe(
      '마지막처럼 (feat. Nobody)',
    )
  })

  it('chanson déjà latine avec parens : intacte (pas de hangul hors parens)', () => {
    expect(displaySongTitle("aespa 'WDA (Whole Different Animal)' MV", 'aespa')).toBe(
      'WDA (Whole Different Animal)',
    )
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
  it("chanson entre crochets DSP (KARD) — pas d'over-strip, glose latine préférée", () => {
    expect(displaySongTitle('KARD - [밤밤(Bomb Bomb)] M/V', 'KARD')).toBe('Bomb Bomb')
  })
  it('’ courbe fermante utilisée en ouvrante (THE BOYZ)', () => {
    expect(displaySongTitle('THE BOYZ(더보이즈) ’Nectar’ MV', 'THE BOYZ')).toBe('Nectar')
  })
})

describe('displaySongTitle — classes du balayage du 2026-08-23 (3 465 events prod)', () => {
  describe('label de clip emballé dans une paire', () => {
    it('(Official Video) — 95 titres le gardaient en prod', () => {
      expect(displaySongTitle('JENNIE - Mantra (Official Video)', 'JENNIE')).toBe('Mantra')
    })
    it('[Official Video]', () => {
      expect(displaySongTitle('Colde - Sunflower [Official Video]', 'Colde')).toBe('Sunflower')
    })
    it('qualificatif inconnu après « Official »', () => {
      expect(displaySongTitle('XG - NEW DANCE (Official Multiverse Music Video)', 'XG')).toBe(
        'NEW DANCE',
      )
    })
    it('un crédit entre parenthèses survit au retrait du label', () => {
      expect(displaySongTitle('pH-1 - MR. BAD (Feat. Blase) (Official Video)', 'pH-1')).toBe(
        'MR. BAD (Feat. Blase)',
      )
    })
    it('« Official » postposé (convention Play M)', () => {
      expect(displaySongTitle('BIBI - Sugar Rush Official M/V', 'BIBI')).toBe('Sugar Rush')
    })
    it('le retrait du label ne rend jamais une chaîne vide', () => {
      expect(displaySongTitle('PINKVERSE official Cherry blossom MV', 'PINKVERSE')).not.toBe('')
    })
  })

  describe('deux segments cités dans le même titre', () => {
    it('le greedy enjambait les deux paires (&TEAM)', () => {
      expect(
        displaySongTitle(
          "&TEAM 'Bewitched' Official MV | 'The Witch of Yerasah' Animated Film",
          '&TEAM',
        ),
      ).toBe('Bewitched')
    })
    it('une parenthèse citée après la chanson (BTS)', () => {
      expect(displaySongTitle("BTS (방탄소년단) 'Dynamite' ('70s remix) MV", 'BTS')).toBe(
        'Dynamite',
      )
    })
    it('apostrophe possessive après la fermante (OnlyOneOf)', () => {
      expect(displaySongTitle("[MV] OnlyOneOf 'suit dance' (lyOn's Den Ver.)", 'OnlyOneOf')).toBe(
        'suit dance',
      )
    })
    it("nom de groupe à apostrophe avant la citation (STARSEED'Z)", () => {
      expect(
        displaySongTitle("STARSEED'Z - SLIP N' SLIDE (Official Music Video)", "STARSEED'Z"),
      ).toBe("SLIP N' SLIDE")
    })
  })

  describe('apostrophes internes conservées', () => {
    it("élision suivie de la fermante (Ridin')", () => {
      expect(displaySongTitle("NCT DREAM 엔시티 드림 'Ridin'' MV", 'NCT DREAM')).toBe("Ridin'")
    })
    it("deux élisions (WHAT'S GOIN' ON)", () => {
      expect(displaySongTitle("OMEGA X 'WHAT'S GOIN' ON' Official MV (B-side)", 'OMEGA X')).toBe(
        "WHAT'S GOIN' ON",
      )
    })
    it("possessif interne (Girls' Night)", () => {
      expect(displaySongTitle("Loossemble (루셈블) - 'Girls' Night' MV", 'Loossemble')).toBe(
        "Girls' Night",
      )
    })
  })

  describe("courbes et crochets d'angle", () => {
    it('ouvrante courbe collée au nom du groupe (GENBLUE)', () => {
      expect(displaySongTitle('GENBLUE‘1000次也不夠的想念’ Official Music Video', 'GENBLUE')).toBe(
        '1000次也不夠的想念',
      )
    })
    it('deux ouvrantes courbes (CLASS:y)', () => {
      expect(displaySongTitle('CLASS:y(클라씨) “CLASSY“ M/V', 'CLASS:y')).toBe('CLASSY')
    })
    it('barre verticale hangul avant la citation (OMEGA X)', () => {
      expect(displaySongTitle("OMEGA X (오메가엑스)ㅣ'HEY!' Special Video", 'OMEGA X')).toBe('HEY!')
    })
    it("crochets d'angle collés au nom (LUN8)", () => {
      expect(displaySongTitle('LUN8「MOTLEY CREW」(Official MV)', 'LUN8')).toBe('MOTLEY CREW')
    })
    it("crochets d'angle DANS une parenthèse = le single, pas la chanson (iKON)", () => {
      expect(
        displaySongTitle(
          'iKON - #WYD M/V Japanese Short Ver. (from Single「DUMB & DUMBER」)',
          'iKON',
        ),
      ).not.toBe('DUMB & DUMBER')
    })
  })

  describe('collaborations', () => {
    it('& co-artiste (JENNIE & Dua Lipa)', () => {
      expect(displaySongTitle('JENNIE & Dua Lipa - Handlebars (Official Video)', 'JENNIE')).toBe(
        'Handlebars',
      )
    })
    it('virgule co-artiste (IVE, David Guetta)', () => {
      expect(
        displaySongTitle('IVE, David Guetta - Supernova Love Official Music Video', 'IVE'),
      ).toBe('Supernova Love')
    })
    it('slash sous-unité (FTISLAND / FT.triple)', () => {
      expect(displaySongTitle('FTISLAND / FT.triple - 러브레터 M/V', 'FTISLAND')).toBe('러브레터')
    })
    it('un tiret INTERNE au co-artiste ne coupe pas', () => {
      expect(displaySongTitle('AOMG & pH-1 - Song Name (Official Video)', 'AOMG')).toBe('Song Name')
    })
  })

  describe('glose entre parenthèses : romanisation ou crédit ?', () => {
    it('romanisation préférée', () => {
      expect(displaySongTitle('BIBI - 밤양갱(Bam Yang Gang) Official M/V', 'BIBI')).toBe(
        'Bam Yang Gang',
      )
    })
    it('crédit instrumental refusé (Guitar by …)', () => {
      expect(
        displaySongTitle(
          "JEONGHAN X WONWOO (SEVENTEEN) '어젯밤 (Guitar by 박주원)' Official MV",
          'SEVENTEEN',
        ),
      ).toBe('어젯밤 (Guitar by 박주원)')
    })
    it('un titre commençant par « By » reste une romanisation', () => {
      expect(
        displaySongTitle(
          'Hi-Fi Un!corn - “어쩌다가(By Chance)” Performance Video',
          'Hi-Fi Un!corn',
        ),
      ).toBe('By Chance')
    })
    it('OST refusé : la parenthèse nomme la série', () => {
      expect(
        displaySongTitle(
          'ADYA (에이디야) - 눈부신 날 (이사장님은 9등급 OST) [Music Video]',
          'ADYA',
        ),
      ).toBe('눈부신 날 (이사장님은 9등급 OST)')
    })
    it('label refusé : la parenthèse nomme le format, pas la chanson', () => {
      // La parenthèse survit (elle n'est pas un suffixe reconnu), mais elle ne
      // REMPLACE plus le titre — le rendu montrait « BTS:Music Video » seul.
      expect(displaySongTitle('BTOB - 스릴러 (BTS:Music Video)', 'BTOB')).toContain('스릴러')
    })
  })
})
