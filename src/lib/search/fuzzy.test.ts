import { describe, expect, it } from 'vitest'
import { allowedEdits, boundedEditDistance, fuzzyMatches, matchRank } from './fuzzy'

describe('boundedEditDistance', () => {
  it('compte une substitution, une insertion, une suppression', () => {
    expect(boundedEditDistance('aespa', 'aespa', 2)).toBe(0)
    expect(boundedEditDistance('aespo', 'aespa', 2)).toBe(1)
    expect(boundedEditDistance('aesp', 'aespa', 2)).toBe(1)
    expect(boundedEditDistance('aesspa', 'aespa', 2)).toBe(1)
  })

  it('compte une INVERSION de deux lettres comme UNE faute', () => {
    // C'est le point de Damerau : Levenshtein facturerait 2 et rejetterait
    // « aepsa » alors que c'est la faute de frappe la plus courante.
    expect(boundedEditDistance('aepsa', 'aespa', 1)).toBe(1)
    expect(boundedEditDistance('babymosnter', 'babymonster', 1)).toBe(1)
  })

  it('renvoie null au-delà du budget', () => {
    expect(boundedEditDistance('aespa', 'blackpink', 2)).toBeNull()
    expect(boundedEditDistance('aespo', 'aespa', 0)).toBeNull()
  })
})

describe('allowedEdits', () => {
  it('ne tolère rien sous 4 caractères', () => {
    expect(allowedEdits(3)).toBe(0)
    expect(allowedEdits(4)).toBe(1)
    expect(allowedEdits(8)).toBe(2)
  })
})

describe('fuzzyMatches', () => {
  it('accepte la saisie exacte et le contenu', () => {
    expect(fuzzyMatches('aespa', 'aespa')).toBe(true)
    expect(fuzzyMatches('monster', 'babymonster')).toBe(true)
  })

  it('accepte une lettre écorchée ou inversée', () => {
    expect(fuzzyMatches('babymonstre', 'babymonster')).toBe(true)
    expect(fuzzyMatches('babymosnter', 'babymonster')).toBe(true)
    expect(fuzzyMatches('blakpink', 'blackpink')).toBe(true)
    expect(fuzzyMatches('stary', 'straykids')).toBe(true)
  })

  it('accepte une frappe PARTIELLE et fautive (préfixe)', () => {
    expect(fuzzyMatches('babymonstr', 'babymonster')).toBe(true)
    expect(fuzzyMatches('enhypn', 'enhypen')).toBe(true)
  })

  it('refuse une saisie courte approximative — trop de collisions', () => {
    expect(fuzzyMatches('ive', 'izna')).toBe(false)
    expect(fuzzyMatches('exo', 'evo')).toBe(false)
  })

  it('refuse deux noms simplement différents', () => {
    expect(fuzzyMatches('blackpink', 'babymonster')).toBe(false)
    expect(fuzzyMatches('newjeans', 'nmixx')).toBe(false)
  })
})

describe('matchRank', () => {
  it('classe exact < préfixe < contenu < approximatif', () => {
    expect(matchRank('aespa', 'aespa')).toBe(0)
    expect(matchRank('aes', 'aespa')).toBe(1)
    expect(matchRank('espa', 'aespa')).toBe(2)
    expect(matchRank('aespo', 'aespa')).toBe(3)
  })
})
