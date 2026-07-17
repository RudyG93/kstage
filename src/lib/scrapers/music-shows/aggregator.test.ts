import { describe, expect, it, vi } from 'vitest'
import { aggregateLineups, FALLBACK_SOURCES } from './aggregator'
import type { ParsedLineup, SourceScraper } from './types'

// NOW = 2026-05-29 12:00 UTC = 21:00 KST le 29 → jour KST courant '2026-05-29'.
const NOW = new Date(Date.UTC(2026, 4, 29, 12, 0))

function makeLineup(
  show: ParsedLineup['show'],
  source: string,
  overrides: Partial<ParsedLineup> = {},
): ParsedLineup {
  return {
    show,
    episodeNumber: null,
    startAtIso: '2026-05-29T08:00:00.000Z', // 17:00 KST le jour de NOW
    isHighlight: false,
    artistsRaw: ['aespa', 'ILLIT', 'IVE'],
    sourceLabel: source,
    ...overrides,
  }
}

function makeSource(
  label: string,
  shows: ParsedLineup['show'][],
  data: ParsedLineup[] | Error,
): SourceScraper {
  return {
    label,
    sourceUrl: `https://mock.example/${label}`,
    shows,
    fetch:
      data instanceof Error ? vi.fn().mockRejectedValue(data) : vi.fn().mockResolvedValue(data),
  }
}

describe('aggregateLineups', () => {
  const ALL_SHOWS: ParsedLineup['show'][] = [
    'the-show',
    'show-champion',
    'm-countdown',
    'music-bank',
    'music-core',
    'inkigayo',
  ]

  it('si le primary couvre tout (lineups du jour), ne fire aucun fallback', async () => {
    const primary = makeSource(
      'mock-primary',
      ALL_SHOWS,
      ALL_SHOWS.map((s) => makeLineup(s, 'mock-primary')),
    )
    const fallback = makeSource(
      'mock-fallback',
      ['music-bank'],
      [makeLineup('music-bank', 'mock-fallback')],
    )
    const { lineups, primaryOk, fallbacksUsed } = await aggregateLineups(NOW, {
      primary,
      fallbacks: [fallback],
    })
    expect(primaryOk).toBe(true)
    expect(lineups.length).toBe(6)
    expect(fallbacksUsed).toEqual([])
    expect(fallback.fetch).not.toHaveBeenCalled()
  })

  it('si le primary manque un show, le fallback le fournit', async () => {
    const primary = makeSource('mock-primary', ALL_SHOWS, [
      makeLineup('m-countdown', 'mock-primary'),
      makeLineup('music-bank', 'mock-primary'),
    ])
    const fallback = makeSource(
      'mock-fallback',
      ['show-champion'],
      [makeLineup('show-champion', 'mock-fallback')],
    )
    const { lineups, fallbacksUsed } = await aggregateLineups(NOW, {
      primary,
      fallbacks: [fallback],
    })
    expect(lineups.length).toBe(3)
    expect(lineups.find((l) => l.show === 'show-champion')?.sourceLabel).toBe('mock-fallback')
    expect(fallbacksUsed).toEqual([{ source: 'mock-fallback', show: 'show-champion' }])
  })

  it('un lineup primary PÉRIMÉ (semaine passée) ne couvre plus : le fallback fournit le futur', async () => {
    // Cas réel du 2026-07-17 : le carrd servait encore l'Inkigayo de dimanche
    // dernier pendant que le board SBS publiait déjà l'épisode suivant.
    const primary = makeSource(
      'mock-primary',
      ['inkigayo'],
      [
        makeLineup('inkigayo', 'mock-primary', {
          startAtIso: '2026-05-24T06:25:00.000Z', // dimanche passé
          episodeNumber: 1317,
        }),
      ],
    )
    const fallback = makeSource(
      'sbs-inkigayo-mock',
      ['inkigayo'],
      [
        makeLineup('inkigayo', 'sbs-inkigayo-mock', {
          startAtIso: '2026-05-31T06:25:00.000Z', // dimanche prochain
          episodeNumber: 1318,
        }),
      ],
    )
    const { lineups, fallbacksUsed } = await aggregateLineups(NOW, {
      primary,
      fallbacks: [fallback],
    })
    expect(fallback.fetch).toHaveBeenCalled()
    // Le lineup passé reste (jour différent → pas de remplacement), le futur s'ajoute.
    expect(lineups.map((l) => l.episodeNumber).sort()).toEqual([1317, 1318])
    expect(fallbacksUsed).toEqual([{ source: 'sbs-inkigayo-mock', show: 'inkigayo' }])
  })

  it("l'épisode du JOUR compte couvert (le run post-diffusion ne fire pas les fallbacks)", async () => {
    const primary = makeSource(
      'mock-primary',
      ['inkigayo'],
      [
        makeLineup('inkigayo', 'mock-primary'), // 17:00 KST aujourd'hui, déjà diffusé à NOW 21:00 KST
      ],
    )
    const fallback = makeSource('sbs-inkigayo-mock', ['inkigayo'], [])
    const { fallbacksUsed } = await aggregateLineups(NOW, { primary, fallbacks: [fallback] })
    expect(fallback.fetch).not.toHaveBeenCalled()
    expect(fallbacksUsed).toEqual([])
  })

  it('remplacement same-day : un lineup MAIGRE (<3) est remplacé par le fallback plus riche', async () => {
    const primary = makeSource(
      'mock-primary',
      ['inkigayo'],
      [makeLineup('inkigayo', 'mock-primary', { artistsRaw: ['aespa'] })],
    )
    const fallback = makeSource(
      'sbs-inkigayo-mock',
      ['inkigayo'],
      [
        makeLineup('inkigayo', 'sbs-inkigayo-mock', {
          artistsRaw: ['aespa', 'ILLIT', 'IVE', 'RIIZE', 'izna'],
        }),
      ],
    )
    const { lineups, fallbacksUsed } = await aggregateLineups(NOW, {
      primary,
      fallbacks: [fallback],
    })
    expect(lineups.length).toBe(1)
    expect(lineups[0].sourceLabel).toBe('sbs-inkigayo-mock')
    expect(lineups[0].artistsRaw.length).toBe(5)
    expect(fallbacksUsed).toEqual([{ source: 'sbs-inkigayo-mock', show: 'inkigayo' }])
  })

  it('si le primary throw, tous les fallbacks tentent et leurs erreurs sont loggées', async () => {
    const primary = makeSource('mock-primary', ['music-bank'], new Error('primary boom'))
    const fallbackOk = makeSource(
      'mock-fb-ok',
      ['music-bank'],
      [makeLineup('music-bank', 'mock-fb-ok')],
    )
    const fallbackFail = makeSource('mock-fb-fail', ['music-core'], new Error('fb boom'))
    const { lineups, primaryOk, errors, fallbacksUsed } = await aggregateLineups(NOW, {
      primary,
      fallbacks: [fallbackOk, fallbackFail],
    })
    expect(primaryOk).toBe(false)
    expect(lineups.length).toBe(1)
    expect(fallbacksUsed.map((f) => f.source)).toEqual(['mock-fb-ok'])
    expect(errors.find((e) => e.source === 'mock-primary')?.error).toContain('primary boom')
    expect(errors.find((e) => e.source === 'mock-fb-fail')?.error).toContain('fb boom')
  })
})

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
