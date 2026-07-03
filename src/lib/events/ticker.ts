// Construction pure des items du ticker live (Data Desk §7.1.2) — testable.

import { formatDDay, kstTime24h, localDayKey } from './date'
import { EVENT_TYPE_LABELS } from './labels'
import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

export interface TickerItem {
  text: string
  live: boolean
}

interface TickerSourceEvent {
  title: string
  type: EventType
  start_at: string
  groups: { name: string } | null
}

/**
 * Transforme les prochains events en labels condensés :
 * - aujourd'hui (KST) : « LIVE TONIGHT — M COUNTDOWN 18:00 KST » (dot live)
 * - à venir mv/release : « AESPA COMEBACK D-2 »
 * - à venir autre : « MUSIC BANK D-3 »
 */
export function buildTickerItems(
  events: readonly TickerSourceEvent[],
  { max = 8, nowIso }: { max?: number; nowIso?: string } = {},
): TickerItem[] {
  const todayKey = localDayKey(nowIso ?? new Date().toISOString(), 'Asia/Seoul')
  const items: TickerItem[] = []
  const seen = new Set<string>()
  const push = (item: TickerItem) => {
    // Dédoublonne (ex. le même music show posé sur 4 groupes suivis).
    if (seen.has(item.text)) return
    seen.add(item.text)
    items.push(item)
  }
  for (const e of events) {
    if (items.length >= max) break
    const isToday = localDayKey(e.start_at, 'Asia/Seoul') === todayKey
    const group = e.groups?.name?.toUpperCase()
    if (isToday) {
      const what = e.type === 'music_show' ? e.title : `${group ?? ''} ${e.title}`.trim()
      push({
        text: `LIVE TONIGHT — ${what.toUpperCase()} ${kstTime24h(e.start_at)} KST`,
        live: true,
      })
    } else if (e.type === 'mv' || e.type === 'release') {
      push({
        text: `${group ?? 'COMEBACK'} COMEBACK ${formatDDay(e.start_at, 'Asia/Seoul', nowIso)}`,
        live: false,
      })
    } else {
      const label = EVENT_TYPE_LABELS[e.type].toUpperCase()
      const subject = e.type === 'music_show' ? e.title.toUpperCase() : `${group ?? ''} ${label}`
      push({
        text: `${subject.trim()} ${formatDDay(e.start_at, 'Asia/Seoul', nowIso)}`,
        live: false,
      })
    }
  }
  return items
}
