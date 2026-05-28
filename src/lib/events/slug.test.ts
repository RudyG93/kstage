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

  // Cas réels prod : le titre commence par le nom du groupe → ne pas dupliquer.
  it('dédoublonne quand le titre commence par le nom du groupe (ATEEZ kpopofficial)', () => {
    expect(buildEventSlug('ateez', 'ATEEZ Album – GOLDEN HOUR : Part.5 (2026)', 'ATEEZ')).toBe(
      'ateez-album-golden-hour-part-5-2026',
    )
  })

  it('dédoublonne quand group.slug ≠ slugify(group.name) (N.Flying → nflying vs n-flying)', () => {
    expect(
      buildEventSlug('nflying', 'N.Flying Digital Single – In Between Seasons (2026)', 'N.Flying'),
    ).toBe('nflying-digital-single-in-between-seasons-2026')
  })

  it('dédoublonne FIFTY FIFTY (slug fiftyfifty vs name → fifty-fifty)', () => {
    expect(
      buildEventSlug(
        'fiftyfifty',
        "FIFTY FIFTY 4th Mini Album – Imperfect-I'mperfect (2026)",
        'Fifty Fifty',
      ),
    ).toBe('fiftyfifty-4th-mini-album-imperfect-i-mperfect-2026')
  })

  it('laisse intact si le titre ne contient pas le nom du groupe (Music Core)', () => {
    expect(buildEventSlug('idle', 'Music Core', 'i-dle')).toBe('idle-music-core')
  })
})
