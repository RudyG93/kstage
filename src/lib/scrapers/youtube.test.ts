import { describe, it, expect } from 'vitest'
import { detectEventType } from './youtube'

describe('detectEventType', () => {
  it('détecte mv', () => {
    expect(detectEventType("aespa 'Whiplash' MV", '')).toBe('mv')
    expect(detectEventType('LE SSERAFIM CRAZY Official Video', '')).toBe('mv')
  })

  it('détecte release', () => {
    expect(detectEventType('aespa - Mini Album', '')).toBe('release')
    expect(detectEventType('ILLIT 2nd Single', '')).toBe('release')
  })

  it('détecte concert', () => {
    expect(detectEventType('World Tour 2026', 'concert details')).toBe('concert')
  })

  it('détecte music_show', () => {
    expect(detectEventType('M Countdown performance', '')).toBe('music_show')
    expect(detectEventType('Inkigayo stage', '')).toBe('music_show')
  })

  it('détecte anniversary', () => {
    expect(detectEventType('Debut Anniversary', '')).toBe('anniversary')
  })

  it('détecte live', () => {
    expect(detectEventType('Weverse Live', '')).toBe('live')
    expect(detectEventType('V Live special', '')).toBe('live')
  })

  it('retourne other par défaut', () => {
    expect(detectEventType('Random video title', 'no keywords')).toBe('other')
  })
})
