import { describe, it, expect } from 'vitest'
import { __testables } from './mv-recovery'

const { nettoyerAlias, isUsableAlias } = __testables
const accepte = (brut: string) => {
  const a = nettoyerAlias(brut)
  return isUsableAlias(a) ? a : null
}

// L'infobox fandom est éditée par n'importe qui, et ses alias servent de
// PRÉDICAT au matching des MV et des stages. Deux fragments de wikitext ont
// franchi la première version de ce garde et sont restés en base.
describe('alias fandom', () => {
  it('accepte un nom hangul', () => {
    expect(accepte('에이엔')).toBe('에이엔')
  })

  it('accepte un nom latin composé', () => {
    expect(accepte('  Miwan   Sonyeon ')).toBe('Miwan Sonyeon')
  })

  it('nettoie une fermeture de template collée au nom (cas AEN en base)', () => {
    expect(accepte('에이엔 )}}')).toBe('에이엔')
  })

  it('refuse un fragment de syntaxe pur (cas V8 en base)', () => {
    expect(accepte('| katakana =')).toBeNull()
  })

  it('refuse un débris AU MILIEU du nom — impossible à nettoyer par les bords', () => {
    expect(accepte('ABC | katakana = DEF')).toBeNull()
  })

  it('refuse un mot générique d’infobox', () => {
    expect(accepte('Korean')).toBeNull()
    expect(accepte('stage name')).toBeNull()
  })

  it('refuse ce qui ne porte ni lettre ni chiffre', () => {
    expect(accepte('—')).toBeNull()
    expect(accepte('()')).toBeNull()
  })

  it('refuse trop court ou trop long', () => {
    expect(accepte('A')).toBeNull()
    expect(accepte('x'.repeat(61))).toBeNull()
  })
})
