import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildStartAtIso, parseLineups, withStartAt } from './live-show-updates'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = readFileSync(
  join(__dirname, '__fixtures__', 'live-show-updates-2026-05-29.txt'),
  'utf8',
)

describe('parseLineups (fixture 2026-05-29)', () => {
  const lineups = parseLineups(FIXTURE)

  it('détecte les 6 shows', () => {
    const shows = lineups.map((l) => l.show).sort()
    expect(shows).toEqual([
      'inkigayo',
      'm-countdown',
      'music-bank',
      'music-core',
      'show-champion',
      'the-show',
    ])
  })

  it('extrait les numéros d’épisode', () => {
    const byShow = Object.fromEntries(lineups.map((l) => [l.show, l.episodeNumber]))
    expect(byShow['the-show']).toBe(394)
    expect(byShow['show-champion']).toBe(598)
    expect(byShow['m-countdown']).toBe(930)
    expect(byShow['music-bank']).toBe(1293)
    expect(byShow['music-core']).toBe(948)
    expect(byShow['inkigayo']).toBe(1312)
  })

  it('extrait dates + horaires KST', () => {
    const byShow = Object.fromEntries(lineups.map((l) => [l.show, l]))
    expect(byShow['the-show'].monthDay).toBe('06/02')
    expect(byShow['the-show'].time12h).toBe('6:00pm')
    expect(byShow['music-bank'].monthDay).toBe('05/29')
    expect(byShow['music-bank'].time12h).toBe('4:57pm')
    expect(byShow['inkigayo'].monthDay).toBe('05/31')
    expect(byShow['inkigayo'].time12h).toBe('3:25pm')
  })

  it('flag highlight broadcast pour Show Champion', () => {
    const sc = lineups.find((l) => l.show === 'show-champion')!
    expect(sc.isHighlight).toBe(true)
    const mb = lineups.find((l) => l.show === 'music-bank')!
    expect(mb.isHighlight).toBe(false)
  })

  it('Music Bank contient aespa + ILLIT', () => {
    const mb = lineups.find((l) => l.show === 'music-bank')!
    expect(mb.artistsRaw).toContain('aespa')
    expect(mb.artistsRaw).toContain('ILLIT')
  })

  it('M Countdown contient ILLIT + ITZY', () => {
    const mc = lineups.find((l) => l.show === 'm-countdown')!
    expect(mc.artistsRaw).toContain('ILLIT')
    expect(mc.artistsRaw).toContain('ITZY')
  })

  it('Music Core contient aespa', () => {
    const mc = lineups.find((l) => l.show === 'music-core')!
    expect(mc.artistsRaw).toContain('aespa')
  })

  it('Inkigayo : lineup multi-paragraphe → FLARE U capturé sur la 2ᵉ ligne', () => {
    const ink = lineups.find((l) => l.show === 'inkigayo')!
    expect(ink.artistsRaw).toContain('aespa')
    expect(ink.artistsRaw).toContain('ILLIT')
    expect(ink.artistsRaw).toContain('FLARE U')
  })
})

describe('buildStartAtIso', () => {
  it('Friday 4:57pm KST le 05/29/2026 → 2026-05-29T07:57:00Z', () => {
    const now = new Date(Date.UTC(2026, 4, 29, 12, 0))
    const iso = buildStartAtIso('05/29', '4:57pm', now)
    expect(iso).toBe('2026-05-29T07:57:00.000Z')
  })

  it('infère 2026 quand today est 2026 et MM/DD est proche', () => {
    const now = new Date(Date.UTC(2026, 4, 29, 12, 0))
    const iso = buildStartAtIso('06/02', '6:00pm', now)
    // 6pm KST = 9am UTC, donc 2026-06-02T09:00:00Z
    expect(iso).toBe('2026-06-02T09:00:00.000Z')
  })

  it('wrap fin d’année : today 2026-01-02, date 12/30 → 2025', () => {
    const now = new Date(Date.UTC(2026, 0, 2, 12, 0))
    const iso = buildStartAtIso('12/30', '6:00pm', now)
    expect(iso?.startsWith('2025-12-30')).toBe(true)
  })

  it('rejette MM/DD invalides', () => {
    const now = new Date()
    expect(buildStartAtIso('13/01', '6:00pm', now)).toBeNull()
    expect(buildStartAtIso('05/32', '6:00pm', now)).toBeNull()
    expect(buildStartAtIso('abc', '6:00pm', now)).toBeNull()
  })

  it('rejette horaires invalides', () => {
    const now = new Date()
    expect(buildStartAtIso('05/29', '25:00pm', now)).toBeNull()
    expect(buildStartAtIso('05/29', '4:67pm', now)).toBeNull()
    expect(buildStartAtIso('05/29', 'noon', now)).toBeNull()
  })

  it('gère midnight am/pm correctement', () => {
    const now = new Date(Date.UTC(2026, 4, 29, 12, 0))
    // 12:00am = midnight KST = 15:00 UTC veille
    expect(buildStartAtIso('05/29', '12:00am', now)).toBe('2026-05-28T15:00:00.000Z')
    // 12:00pm = midi KST = 03:00 UTC
    expect(buildStartAtIso('05/29', '12:00pm', now)).toBe('2026-05-29T03:00:00.000Z')
  })
})

describe('withStartAt', () => {
  it('attache startAtIso à chaque RawLineup parseable', () => {
    const now = new Date(Date.UTC(2026, 4, 29, 12, 0))
    const raws = parseLineups(FIXTURE)
    const parsed = withStartAt(raws, now)
    expect(parsed.length).toBe(raws.length)
    for (const p of parsed) {
      expect(p.startAtIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    }
  })
})
