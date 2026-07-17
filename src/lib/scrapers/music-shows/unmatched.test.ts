import { describe, it, expect } from 'vitest'
import { cleanUnmatchedName, collectUnmatched, type UnmatchedCollector } from './unmatched'

describe('cleanUnmatchedName — filtre anti-bruit (cas réels scrape_log)', () => {
  it('accepte un vrai groupe et normalise', () => {
    expect(cleanUnmatchedName('TRENDZ')).toEqual({ nameNorm: 'trendz', display: 'TRENDZ' })
  })

  it('strippe le préfixe astérisques inkigayo (« ** GIRLSET »)', () => {
    expect(cleanUnmatchedName('** GIRLSET')).toEqual({ nameNorm: 'girlset', display: 'GIRLSET' })
  })

  it('rejette le séparateur carrd « ~ » et les fragments courts', () => {
    expect(cleanUnmatchedName('~')).toBeNull()
    expect(cleanUnmatchedName(' * ')).toBeNull()
  })

  it('rejette les stages MC/spéciaux', () => {
    expect(cleanUnmatchedName('MC Special Stage (MINJAE & CHUEI LYU')).toBeNull()
    expect(cleanUnmatchedName('mc lineup')).toBeNull()
  })

  it('rejette une parenthèse jamais fermée (nom tronqué)', () => {
    expect(cleanUnmatchedName('SOMEONE (feat. TRU')).toBeNull()
  })

  it('garde un nom avec parenthèses équilibrées', () => {
    expect(cleanUnmatchedName('기현 (몬스타엑스)')).not.toBeNull()
  })
})

describe('collectUnmatched — dédup par nom normalisé, union des shows', () => {
  it('agrège les shows et déduplique les variantes du même nom', () => {
    const c: UnmatchedCollector = new Map()
    collectUnmatched(c, 'TRENDZ', 'music-bank')
    collectUnmatched(c, '** TRENDZ', 'inkigayo')
    collectUnmatched(c, '~', 'inkigayo')
    expect(c.size).toBe(1)
    const entry = c.get('trendz')
    expect(entry?.display).toBe('TRENDZ')
    expect([...(entry?.shows ?? [])].sort()).toEqual(['inkigayo', 'music-bank'])
  })
})
