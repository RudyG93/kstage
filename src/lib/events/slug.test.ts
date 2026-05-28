import { describe, it, expect } from 'vitest'
import { slugify, buildEventSlug } from './slug'

describe('slugify', () => {
  it('lowercase + dashes pour les espaces', () => {
    expect(slugify('Golden Hour Part 5')).toBe('golden-hour-part-5')
  })

  it('strip les accents (ascii-fold)', () => {
    expect(slugify('Pâté & Crème brûlée')).toBe('pate-creme-brulee')
  })

  it('dédoublonne les dashes', () => {
    expect(slugify('hello   ---   world')).toBe('hello-world')
  })

  it('trim les dashes en début/fin', () => {
    expect(slugify(' - hello - ')).toBe('hello')
  })

  it('gère les caractères k-pop typiques', () => {
    expect(slugify('aespa — Lemonade (Official Video)')).toBe('aespa-lemonade-official-video')
    expect(slugify('ATEEZ Album – GOLDEN HOUR : Part.5 (2026)')).toBe(
      'ateez-album-golden-hour-part-5-2026',
    )
  })

  it('chaîne vide ou que des séparateurs → vide', () => {
    expect(slugify('')).toBe('')
    expect(slugify('---')).toBe('')
  })
})

describe('buildEventSlug', () => {
  it('préfixe par le groupSlug', () => {
    expect(buildEventSlug('ateez', 'Golden Hour Part 5')).toBe('ateez-golden-hour-part-5')
  })

  it('si le titre est vide, retourne juste le groupSlug', () => {
    expect(buildEventSlug('aespa', '')).toBe('aespa')
  })

  it('limite à 80 caractères et trim un dash de fin', () => {
    const long = 'a'.repeat(200)
    const result = buildEventSlug('group', long)
    expect(result.length).toBeLessThanOrEqual(80)
    expect(result.endsWith('-')).toBe(false)
  })
})
