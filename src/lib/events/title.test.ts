import { describe, it, expect } from 'vitest'
import { displayEventTitle } from './title'

describe('displayEventTitle', () => {
  it('retire le préfixe groupe + année + normalise Part.N (cas réel ATEEZ)', () => {
    expect(displayEventTitle('ATEEZ Album - Golden Hour : Part.5 (2026)', 'ATEEZ')).toBe(
      'Golden Hour : Part 5',
    )
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
