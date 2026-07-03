import { describe, it, expect } from 'vitest'
import { buildTickerItems } from './ticker'

// now = 2026-07-02 12:00 KST (03:00 UTC)
const now = '2026-07-02T03:00:00Z'

const ev = (over: Partial<Parameters<typeof buildTickerItems>[0][number]> = {}) => ({
  title: 'Whiplash',
  type: 'mv' as const,
  start_at: '2026-07-04T09:00:00Z',
  groups: { name: 'aespa' },
  ...over,
})

describe('buildTickerItems', () => {
  it('renders an upcoming comeback as GROUP COMEBACK D-n', () => {
    const [item] = buildTickerItems([ev()], { nowIso: now })
    expect(item).toEqual({ text: 'AESPA COMEBACK D-2', live: false })
  })

  it('renders a same-day (KST) event as LIVE TONIGHT with the KST time', () => {
    const [item] = buildTickerItems(
      [ev({ type: 'music_show', title: 'M Countdown', start_at: '2026-07-02T09:00:00Z' })],
      { nowIso: now },
    )
    expect(item.live).toBe(true)
    expect(item.text).toBe('LIVE TONIGHT — M COUNTDOWN 18:00 KST')
  })

  it('renders a future music show with its title and D-day', () => {
    const [item] = buildTickerItems(
      [ev({ type: 'music_show', title: 'Music Bank', start_at: '2026-07-03T08:00:00Z' })],
      { nowIso: now },
    )
    expect(item).toEqual({ text: 'MUSIC BANK D-1', live: false })
  })

  it('caps the number of items', () => {
    const events = Array.from({ length: 12 }, (_, i) => ev({ groups: { name: `group${i}` } }))
    expect(buildTickerItems(events, { max: 8, nowIso: now })).toHaveLength(8)
  })

  it('dedupes identical labels (same music show on several followed groups)', () => {
    const show = ev({ type: 'music_show' as const, title: 'Music Bank' })
    expect(buildTickerItems([show, show, show], { nowIso: now })).toHaveLength(1)
  })
})
