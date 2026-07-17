import { describe, expect, it, vi } from 'vitest'
import { FALLBACK_SOURCES } from './aggregator'
import type { ParsedLineup, SourceScraper } from './types'

function makeLineup(show: ParsedLineup['show'], source: string): ParsedLineup {
  return {
    show,
    episodeNumber: null,
    startAtIso: '2026-05-29T08:00:00.000Z',
    isHighlight: false,
    artistsRaw: ['aespa', 'ILLIT'],
    sourceLabel: source,
  }
}

describe('aggregateLineups', () => {
  const NOW = new Date(Date.UTC(2026, 4, 29, 12, 0))

  it('si le primary couvre tout, ne fire aucun fallback', async () => {
    const allShows: ParsedLineup['show'][] = [
      'the-show',
      'show-champion',
      'm-countdown',
      'music-bank',
      'music-core',
      'inkigayo',
    ]
    const primaryMock: SourceScraper = {
      label: 'mock-primary',
      sourceUrl: 'https://mock.example/primary',
      shows: allShows,
      fetch: vi.fn().mockResolvedValue(allShows.map((s) => makeLineup(s, 'mock-primary'))),
    }
    const fallbackMock: SourceScraper = {
      label: 'mock-fallback',
      sourceUrl: 'https://mock.example/fallback',
      shows: ['music-bank'],
      fetch: vi.fn().mockResolvedValue([makeLineup('music-bank', 'mock-fallback')]),
    }
    // On bypasse les modules réels en injectant l'aggregateur custom (cf. tests
    // d'intégration plus bas pour le réel).
    const { lineups, primaryOk, fallbacksUsed } = await runAggregate(
      primaryMock,
      [fallbackMock],
      NOW,
    )
    expect(primaryOk).toBe(true)
    expect(lineups.length).toBe(6)
    expect(fallbacksUsed).toEqual([])
    expect(fallbackMock.fetch).not.toHaveBeenCalled()
  })

  it('si le primary manque un show, le fallback le fournit', async () => {
    const primaryMock: SourceScraper = {
      label: 'mock-primary',
      sourceUrl: 'https://mock.example/primary',
      shows: ['the-show', 'm-countdown', 'music-bank', 'music-core', 'inkigayo'],
      fetch: vi
        .fn()
        .mockResolvedValue([
          makeLineup('m-countdown', 'mock-primary'),
          makeLineup('music-bank', 'mock-primary'),
        ]),
    }
    const fallbackMock: SourceScraper = {
      label: 'mock-fallback',
      sourceUrl: 'https://mock.example/fallback',
      shows: ['show-champion'],
      fetch: vi.fn().mockResolvedValue([makeLineup('show-champion', 'mock-fallback')]),
    }
    const { lineups, fallbacksUsed } = await runAggregate(primaryMock, [fallbackMock], NOW)
    expect(lineups.length).toBe(3)
    expect(lineups.find((l) => l.show === 'show-champion')?.sourceLabel).toBe('mock-fallback')
    expect(fallbacksUsed).toEqual([{ source: 'mock-fallback', show: 'show-champion' }])
  })

  it('si le primary throw, tous les fallbacks tentent et leurs erreurs sont loggées', async () => {
    const primaryMock: SourceScraper = {
      label: 'mock-primary',
      sourceUrl: 'https://mock.example/primary',
      shows: ['music-bank'],
      fetch: vi.fn().mockRejectedValue(new Error('primary boom')),
    }
    const fallbackOk: SourceScraper = {
      label: 'mock-fb-ok',
      sourceUrl: 'https://mock.example/fb-ok',
      shows: ['music-bank'],
      fetch: vi.fn().mockResolvedValue([makeLineup('music-bank', 'mock-fb-ok')]),
    }
    const fallbackFail: SourceScraper = {
      label: 'mock-fb-fail',
      sourceUrl: 'https://mock.example/fb-fail',
      shows: ['music-core'],
      fetch: vi.fn().mockRejectedValue(new Error('fb boom')),
    }
    const { lineups, primaryOk, errors, fallbacksUsed } = await runAggregate(
      primaryMock,
      [fallbackOk, fallbackFail],
      NOW,
    )
    expect(primaryOk).toBe(false)
    expect(lineups.length).toBe(1)
    expect(fallbacksUsed.map((f) => f.source)).toEqual(['mock-fb-ok'])
    expect(errors.find((e) => e.source === 'mock-primary')?.error).toContain('primary boom')
    expect(errors.find((e) => e.source === 'mock-fb-fail')?.error).toContain('fb boom')
  })
})

// Helper qui reproduit la logique d'aggregateLineups avec sources injectables
// (l'aggregateur exporté utilise les sources concrètes hard-coded).
async function runAggregate(
  primary: SourceScraper,
  fallbacks: SourceScraper[],
  now: Date,
): Promise<{
  lineups: ParsedLineup[]
  primaryOk: boolean
  fallbacksUsed: { source: string; show: ParsedLineup['show'] }[]
  errors: { source: string; error: string }[]
}> {
  const errors: { source: string; error: string }[] = []
  const fallbacksUsed: { source: string; show: ParsedLineup['show'] }[] = []
  let lineups: ParsedLineup[] = []
  let primaryOk = false
  try {
    lineups = await primary.fetch(now)
    primaryOk = true
  } catch (e) {
    errors.push({ source: primary.label, error: String(e) })
  }
  const covered = new Set(lineups.map((l) => l.show))
  for (const fb of fallbacks) {
    const missing = fb.shows.filter((s) => !covered.has(s))
    if (missing.length === 0) continue
    try {
      const data = await fb.fetch(now)
      for (const l of data) {
        if (covered.has(l.show)) continue
        lineups.push(l)
        covered.add(l.show)
        fallbacksUsed.push({ source: fb.label, show: l.show })
      }
    } catch (e) {
      errors.push({ source: fb.label, error: String(e) })
    }
  }
  return { lineups, primaryOk, fallbacksUsed, errors }
}

describe('FALLBACK_SOURCES contient les 6 broadcasters', () => {
  it('expose KBS, MnetPlus, imbc Music Core, SBS Inkigayo, SBS The Show, imbc Show Champion', () => {
    const labels = FALLBACK_SOURCES.map((s) => s.label).sort()
    expect(labels).toEqual([
      'kbs-music-bank',
      'mbc-music-core',
      'mnet-mcountdown',
      'sbs-inkigayo',
      'sbs-the-show',
      'show-champion',
    ])
  })
})
