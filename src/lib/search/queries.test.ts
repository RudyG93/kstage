import { describe, it, expect } from 'vitest'
import { sanitizeIlike } from './queries'

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
