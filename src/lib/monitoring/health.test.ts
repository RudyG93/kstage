import { describe, it, expect } from 'vitest'
import { evaluateSourceHealth, type ScrapeLogRow, type SourceSpec } from './health'

const NOW = new Date('2026-07-16T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

const row = (
  source: string,
  status: string,
  startedHoursAgo: number,
  details: unknown = null,
): ScrapeLogRow => ({ source, status, started_at: hoursAgo(startedHoursAgo), details })

// Spec réduite pour des tests lisibles (la vraie liste vit dans MONITORED_SOURCES).
const SPECS: SourceSpec[] = [
  { source: 'music_shows', label: 'Music shows', cadenceHours: 12, critical: true },
  { source: 'youtube', label: 'YouTube MVs', cadenceHours: 24, critical: true },
  { source: 'wikipedia', label: 'Wikipedia', cadenceHours: 24, critical: false },
]

describe('evaluateSourceHealth', () => {
  it('règle 1 : deux runs consécutifs non-ok → alerte', () => {
    const { alerts } = evaluateSourceHealth(
      [row('youtube', 'partial', 2), row('youtube', 'error', 26), row('youtube', 'ok', 50)],
      NOW,
      SPECS,
    )
    expect(alerts.some((a) => a.includes('2 runs consécutifs'))).toBe(true)
  })

  it('règle 1 : partial puis ok → pas d’alerte consécutive', () => {
    const { checks } = evaluateSourceHealth(
      [row('youtube', 'partial', 2), row('youtube', 'ok', 26)],
      NOW,
      SPECS,
    )
    const yt = checks.find((c) => c.source === 'youtube')!
    expect(yt.alerts.filter((a) => a.includes('consécutifs'))).toEqual([])
  })

  it('règle 2 : stale_alerts du dernier run music_shows → alerte immédiate', () => {
    const { alerts } = evaluateSourceHealth(
      [
        row('music_shows', 'partial', 1, { stale_alerts: ['M Countdown 2026-07-17 sans lineup'] }),
        row('music_shows', 'ok', 13),
        row('youtube', 'ok', 2),
      ],
      NOW,
      SPECS,
    )
    expect(alerts.some((a) => a.includes('M Countdown'))).toBe(true)
    // Un seul run partial → pas d'alerte règle 1 en plus.
    expect(alerts.filter((a) => a.includes('consécutifs'))).toEqual([])
  })

  it('règle 2 : details malformé (jsonb inattendu) → pas de crash, pas d’alerte', () => {
    const { alerts } = evaluateSourceHealth(
      [
        row('music_shows', 'ok', 1, 'notanobject'),
        row('youtube', 'ok', 2),
        row('music_shows', 'ok', 13, { stale_alerts: 'notanarray' }),
      ],
      NOW,
      SPECS,
    )
    expect(alerts.filter((a) => a.includes('J-1'))).toEqual([])
  })

  it('règle 3 : source critique sans run ok depuis 2 × cadence → alerte', () => {
    const { alerts } = evaluateSourceHealth(
      [row('youtube', 'partial', 2), row('youtube', 'ok', 60), row('music_shows', 'ok', 1)],
      NOW,
      SPECS,
    )
    expect(alerts.some((a) => a.includes('YouTube MVs: aucun run ok depuis 60 h'))).toBe(true)
  })

  it('règle 3 : source critique jamais loguée → alerte ; non-critique absente → silencieuse', () => {
    const { alerts, checks } = evaluateSourceHealth([row('music_shows', 'ok', 1)], NOW, SPECS)
    expect(alerts.some((a) => a.includes('YouTube MVs: aucun run ok depuis jamais'))).toBe(true)
    const wiki = checks.find((c) => c.source === 'wikipedia')!
    expect(wiki.alerts).toEqual([])
    expect(wiki.lastRunAt).toBeNull()
  })

  it('tout sain → zéro alerte, checks renseignés', () => {
    const { alerts, checks } = evaluateSourceHealth(
      [row('music_shows', 'ok', 1), row('youtube', 'ok', 2), row('wikipedia', 'ok', 3)],
      NOW,
      SPECS,
    )
    expect(alerts).toEqual([])
    expect(checks).toHaveLength(3)
    expect(checks.every((c) => c.lastStatus === 'ok')).toBe(true)
  })

  it('les rows arrivent non triées → le plus récent gagne quand même', () => {
    const { checks } = evaluateSourceHealth(
      [row('youtube', 'ok', 26), row('youtube', 'partial', 2)],
      NOW,
      SPECS,
    )
    const yt = checks.find((c) => c.source === 'youtube')!
    expect(yt.lastStatus).toBe('partial')
    expect(yt.lastOkAt).toBe(hoursAgo(26))
  })
})
