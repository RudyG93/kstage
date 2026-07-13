import { describe, it, expect } from 'vitest'
import { buildTickerItems, pickTickerEvents } from './ticker'
import { EVENT_TYPE_COLORS } from './labels'

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
  it('renders an upcoming comeback with the song name (R5): GROUP · SONG D-n', () => {
    const [item] = buildTickerItems([ev()], { nowIso: now })
    expect(item).toEqual({
      text: 'AESPA · WHIPLASH D-2',
      live: false,
      color: EVENT_TYPE_COLORS.mv,
    })
  })

  it('renders a same-day (KST) event as LIVE TONIGHT with the KST time', () => {
    const [item] = buildTickerItems(
      [ev({ type: 'music_show', title: 'M Countdown', start_at: '2026-07-02T09:00:00Z' })],
      { nowIso: now },
    )
    expect(item.live).toBe(true)
    expect(item.text).toBe('LIVE TONIGHT — M COUNTDOWN 18:00 KST')
    expect(item.color).toBe(EVENT_TYPE_COLORS.music_show)
  })

  it('renders a future music show with its title and D-day', () => {
    const [item] = buildTickerItems(
      [ev({ type: 'music_show', title: 'Music Bank', start_at: '2026-07-03T08:00:00Z' })],
      { nowIso: now },
    )
    expect(item.text).toBe('MUSIC BANK D-1')
    expect(item.live).toBe(false)
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

describe('pickTickerEvents', () => {
  const src = (groupId: string, name: string, startAt: string) => ({
    title: 'Song',
    type: 'mv' as const,
    start_at: startAt,
    group_id: groupId,
    groups: { name },
  })

  it('garde un event par groupe et privilégie les groupes les plus suivis', () => {
    const events = [
      src('a', 'Small Group', '2026-07-03T00:00:00Z'),
      src('a', 'Small Group', '2026-07-05T00:00:00Z'), // 2e event du même groupe → ignoré
      src('b', 'Big Group', '2026-07-06T00:00:00Z'),
      src('c', 'Mid Group', '2026-07-04T00:00:00Z'),
    ]
    const counts = new Map([
      ['a', 1],
      ['b', 50],
      ['c', 10],
    ])
    const picked = pickTickerEvents(events, counts, 2)
    // Top-2 par follows = b et c ; sortie re-triée par date (c avant b).
    expect(picked.map((e) => e.group_id)).toEqual(['c', 'b'])
  })

  it('inclut les groupes non suivis (0 follow) quand il reste de la place', () => {
    const events = [src('a', 'A', '2026-07-03T00:00:00Z'), src('b', 'B', '2026-07-04T00:00:00Z')]
    const picked = pickTickerEvents(events, new Map(), 8)
    expect(picked).toHaveLength(2)
  })
})
