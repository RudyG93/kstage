import { describe, it, expect } from 'vitest'
import { sanitizeIlike, tokenize, resolveGroupTokens } from './queries'

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
