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
  it('quotes straight : extrait WDA (Feat. G-DRAGON) — apostrophe curly intérieure OK', () => {
    expect(
      displaySongTitle("aespa 에스파 'WDA (Whole Different Animal) (Feat. G-DRAGON)' MV"),
    ).toBe('WDA (Whole Different Animal) (Feat. G-DRAGON)')
  })

  it('groupe en hangul + chanson en hangul : strip groupe, garde Klaxon hangul', () => {
    expect(
      displaySongTitle("(여자)아이들((G)I-DLE) - '클락션 (Klaxon)' Official Music Video"),
    ).toBe('클락션 (Klaxon)')
  })

  it("apostrophe curly U+2019 à l'intérieur de quotes straight — straight outer matche", () => {
    expect(displaySongTitle("ILLIT (아일릿) 'It’s Me' Official MV (MOKA ver.)")).toBe('It’s Me')
  })

  it('chanson en hangul seul', () => {
    expect(displaySongTitle("BABYMONSTER - '춤 (CHOOM)' M/V")).toBe('춤 (CHOOM)')
  })

  it('chanson mono-mot', () => {
    expect(displaySongTitle("aespa 'Whiplash' Official MV")).toBe('Whiplash')
  })

  it('curly quotes ‘ ’ (priorité 1, avant straight)', () => {
    expect(displaySongTitle('aespa ‘Drama’ Official MV')).toBe('Drama')
  })

  it('pas de quotes : fallback strip MV suffix + groupe', () => {
    expect(displaySongTitle('Random Title Sans Quotes MV', 'aespa')).toBe(
      'Random Title Sans Quotes',
    )
  })

  it('pas de quotes ni MV suffix : retourne le titre nettoyé', () => {
    expect(displaySongTitle('Just a title', null)).toBe('Just a title')
  })

  it('titre vide → vide', () => {
    expect(displaySongTitle('', null)).toBe('')
  })

  it('fallback : "Official Music Video" trailing strippé (groupe sans séparateur reste, limitation displayEventTitle)', () => {
    // displayEventTitle requiert un séparateur (—/–/-/:) après le nom du groupe
    // pour le strip. Sans, le préfixe groupe reste. C'est OK en pratique car
    // 95% des MVs ont des quotes (priorité 1 du helper).
    expect(displaySongTitle('aespa Hot Mess Official Music Video', 'aespa')).toBe('aespa Hot Mess')
  })

  it('fallback avec séparateur : strip groupe ET MV suffix', () => {
    expect(displaySongTitle('aespa - Hot Mess Official MV', 'aespa')).toBe('Hot Mess')
  })
})
