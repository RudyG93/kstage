import { describe, it, expect } from 'vitest'
import { parseSuggestionInput, parseKstLocal, type RawSuggestion } from './validation'

describe('parseKstLocal', () => {
  it('convertit l’horloge KST en UTC (-9h)', () => {
    expect(parseKstLocal('2026-06-15T18:00')).toBe('2026-06-15T09:00:00.000Z')
  })
  it('gère minuit KST (jour précédent en UTC)', () => {
    expect(parseKstLocal('2026-06-15T00:00')).toBe('2026-06-14T15:00:00.000Z')
  })
  it('renvoie null sur format ou valeurs invalides', () => {
    expect(parseKstLocal('2026-06-15')).toBeNull()
    expect(parseKstLocal('')).toBeNull()
    expect(parseKstLocal('2026-13-40T99:99')).toBeNull()
  })
})

describe('parseSuggestionInput', () => {
  const base: RawSuggestion = {
    groupId: 'g1',
    type: 'comeback',
    title: 'aespa — new MV',
    startAtLocal: '2026-06-15T18:00',
    sourceUrl: '',
    description: '',
  }

  it('valide et normalise une saisie correcte', () => {
    const r = parseSuggestionInput(base)
    expect('value' in r).toBe(true)
    if ('value' in r) {
      expect(r.value.startAt).toBe('2026-06-15T09:00:00.000Z')
      expect(r.value.sourceUrl).toBeNull()
      expect(r.value.type).toBe('comeback')
    }
  })

  it('rejette un type non suggérable (other) ou inconnu', () => {
    expect('error' in parseSuggestionInput({ ...base, type: 'other' })).toBe(true)
    expect('error' in parseSuggestionInput({ ...base, type: 'xxx' })).toBe(true)
  })

  it('rejette un titre vide ou trop long', () => {
    expect('error' in parseSuggestionInput({ ...base, title: '   ' })).toBe(true)
    expect('error' in parseSuggestionInput({ ...base, title: 'a'.repeat(121) })).toBe(true)
  })

  it('rejette un groupe manquant', () => {
    expect('error' in parseSuggestionInput({ ...base, groupId: '' })).toBe(true)
  })

  it('valide une source http(s), rejette le reste', () => {
    expect('value' in parseSuggestionInput({ ...base, sourceUrl: 'https://x.com/a' })).toBe(true)
    expect('error' in parseSuggestionInput({ ...base, sourceUrl: 'ftp://x' })).toBe(true)
  })

  it('rejette une date invalide', () => {
    expect('error' in parseSuggestionInput({ ...base, startAtLocal: 'nope' })).toBe(true)
  })
})
