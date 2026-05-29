import { describe, expect, it } from 'vitest'
import { extractCanonicalName } from './canonical'

describe('extractCanonicalName', () => {
  it('laisse les noms ASCII simples intacts', () => {
    expect(extractCanonicalName('aespa')).toBe('aespa')
    expect(extractCanonicalName('ILLIT')).toBe('ILLIT')
    expect(extractCanonicalName('LE SSERAFIM')).toBe('LE SSERAFIM')
    expect(extractCanonicalName('Park Hyun Kyu')).toBe('Park Hyun Kyu')
  })

  it('strip Korean prefix devant les parens anglaises', () => {
    expect(extractCanonicalName('아일릿(ILLIT)')).toBe('ILLIT')
    expect(extractCanonicalName('원위(ONEWE)')).toBe('ONEWE')
    expect(extractCanonicalName('비비(BIBI)')).toBe('BIBI')
  })

  it('strip Korean entre parens en suffix', () => {
    expect(extractCanonicalName('ITZY(있지)')).toBe('ITZY')
    expect(extractCanonicalName('YUHZ(유어즈)')).toBe('YUHZ')
    expect(extractCanonicalName('AND2BLE (앤더블)')).toBe('AND2BLE')
  })

  it('strip "(feat. …)" annotations', () => {
    expect(extractCanonicalName('TAEYANG (feat. TARZZAN, WOOCHAN)')).toBe('TAEYANG')
    expect(extractCanonicalName('태양 (feat. TARZZAN, WOOCHAN)')).toBe('태양')
    expect(extractCanonicalName('Crush (ft. NewJeans)')).toBe('Crush')
  })

  it('garde le nom coréen seul quand pas de version ASCII', () => {
    expect(extractCanonicalName('태양')).toBe('태양')
    expect(extractCanonicalName('박현규')).toBe('박현규')
  })

  it('strings vides ou whitespace → vide', () => {
    expect(extractCanonicalName('')).toBe('')
    expect(extractCanonicalName('   ')).toBe('')
  })

  it('collapse whitespace excessif', () => {
    expect(extractCanonicalName('  LE   SSERAFIM   ')).toBe('LE SSERAFIM')
  })
})
