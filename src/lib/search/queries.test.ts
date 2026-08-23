import { describe, it, expect } from 'vitest'
import { aliasMatches, sanitizeIlike, tokenize, resolveGroupTokens } from './queries'
import { normalize } from '@/lib/scrapers/group-match'

describe('sanitizeIlike', () => {
  it('escapes ilike wildcards', () => {
    expect(sanitizeIlike('100%')).toBe('100\\%')
    expect(sanitizeIlike('a_b')).toBe('a\\_b')
    expect(sanitizeIlike('back\\slash')).toBe('back\\\\slash')
  })

  it('strips commas (they break PostgREST .or() strings)', () => {
    expect(sanitizeIlike('aespa, illit')).toBe('aespa  illit')
  })

  it('trims and caps the length', () => {
    expect(sanitizeIlike('  aespa  ')).toBe('aespa')
    expect(sanitizeIlike('x'.repeat(200))).toHaveLength(80)
  })

  it('returns an empty string for whitespace-only input', () => {
    expect(sanitizeIlike('   ')).toBe('')
  })
})

describe('tokenize', () => {
  it('splits on whitespace and drops single chars', () => {
    expect(tokenize('Music Bank aespa')).toEqual(['Music', 'Bank', 'aespa'])
    expect(tokenize('a  bb')).toEqual(['bb'])
  })
})

describe('resolveGroupTokens (« Music Bank aespa », retour Rudy 2026-07-03)', () => {
  const groups = [
    { id: 'g-aespa', name: 'aespa' },
    { id: 'g-ive', name: 'IVE' },
    { id: 'g-skz', name: 'Stray Kids' },
    { id: 'g-dc', name: 'Dreamcatcher' },
  ]

  it('sépare les tokens groupe des tokens titre', () => {
    const { groupIds, titleTokens } = resolveGroupTokens(['Music', 'Bank', 'aespa'], groups)
    expect(groupIds).toEqual(['g-aespa'])
    expect(titleTokens).toEqual(['Music', 'Bank'])
  })

  it('matche par égalité normalisée même pour les noms courts (IVE) sans faux amis', () => {
    const { groupIds, titleTokens } = resolveGroupTokens(['ive', 'inkigayo'], groups)
    expect(groupIds).toEqual(['g-ive'])
    expect(titleTokens).toEqual(['inkigayo'])
  })

  it('matche un nom multi-mots par containment (≥ 4 chars)', () => {
    const { groupIds } = resolveGroupTokens(['stray', 'comeback'], groups)
    expect(groupIds).toEqual(['g-skz'])
  })

  it('sans token groupe, tout part en tokens titre', () => {
    const { groupIds, titleTokens } = resolveGroupTokens(['music', 'bank'], groups)
    expect(groupIds).toEqual([])
    expect(titleTokens).toEqual(['music', 'bank'])
  })
})

describe('resolveGroupTokens — tolérance aux fautes (retour Rudy 2026-08-21)', () => {
  const groups = [
    { id: 'bm', name: 'BABYMONSTER' },
    { id: 'ae', name: 'aespa' },
    { id: 'sk', name: 'Stray Kids' },
  ]

  it('rattrape une lettre écorchée ou inversée sur le nom du groupe', () => {
    expect(resolveGroupTokens(['babymonstre'], groups).groupIds).toEqual(['bm'])
    expect(resolveGroupTokens(['aepsa'], groups).groupIds).toEqual(['ae'])
  })

  it('laisse la correspondance FRANCHE primer sur l’approximative', () => {
    // « aespa » est exact : il ne doit pas ramener aussi un voisin.
    expect(resolveGroupTokens(['aespa'], groups).groupIds).toEqual(['ae'])
  })

  it('sépare le token membre du token groupe (« asa babymonster »)', () => {
    const { groupIds, titleTokens } = resolveGroupTokens(['asa', 'babymonster'], groups)
    expect(groupIds).toEqual(['bm'])
    expect(titleTokens).toEqual(['asa'])
  })

  it('ne transforme pas un mot quelconque en groupe', () => {
    expect(resolveGroupTokens(['comeback'], groups).groupIds).toEqual([])
    expect(resolveGroupTokens(['comeback'], groups).titleTokens).toEqual(['comeback'])
  })
})

describe('aliasMatches (hangul, abréviations, ancien nom — 2026-08-23)', () => {
  it('reconnaît une abréviation du fandom', () => {
    expect(aliasMatches('zb1', ['제로베이스원', 'ZB1'])).toBe(true)
  })

  it('reconnaît le hangul', () => {
    expect(aliasMatches(normalize('방탄소년단'), ['방탄소년단'])).toBe(true)
    expect(aliasMatches(normalize('에스파'), ['에스파'])).toBe(true)
  })

  it("reconnaît l'ancien nom en containment", () => {
    expect(aliasMatches('tomorrowxtogether', ['투모로우바이투게더', 'TOMORROW X TOGETHER'])).toBe(
      true,
    )
  })

  it('ne matche PAS de façon approximative', () => {
    // « Kiseu obeu raipeu Kisuoburaifu » est un alias réel de Kiss of Life :
    // une tolérance aux fautes dessus ferait matcher à peu près n'importe quoi.
    expect(aliasMatches('kiseuxbeu', ['Kiseu obeu raipeu Kisuoburaifu'])).toBe(false)
  })

  it('ignore les listes vides et les needles vides', () => {
    expect(aliasMatches('', ['ZB1'])).toBe(false)
    expect(aliasMatches('zb1', null)).toBe(false)
    expect(aliasMatches('zb1', [])).toBe(false)
  })
})

describe('resolveGroupTokens — les alias comptent comme le nom', () => {
  const groups = [
    { id: 'zb1', name: 'ZEROBASEONE', name_aliases: ['제로베이스원', 'ZB1'] },
    { id: 'txt', name: 'TXT', name_aliases: ['TOMORROW X TOGETHER'] },
    { id: 'ae', name: 'aespa', name_aliases: null },
  ]

  it('« zb1 » désigne ZEROBASEONE', () => {
    expect(resolveGroupTokens(['zb1'], groups).groupIds).toEqual(['zb1'])
  })

  it('« tomorrow x together » désigne TXT sans laisser de token de titre', () => {
    const { groupIds, titleTokens } = resolveGroupTokens(['tomorrow', 'together'], groups)
    expect(groupIds).toEqual(['txt'])
    expect(titleTokens).toEqual([])
  })

  it('un groupe sans alias reste inchangé', () => {
    expect(resolveGroupTokens(['aespa'], groups).groupIds).toEqual(['ae'])
  })
})
