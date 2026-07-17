// Construction pure des items du ticker live (Data Desk §7.1.2) — testable.

import { formatDDay, kstTime24h, localDayKey } from './date'
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from './labels'
import { displayEventTitle } from './title'
import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

export interface TickerItem {
  text: string
  /** Aujourd'hui (KST) : dot --live pulsante. */
  live: boolean
  /** Couleur du dot (couleur du type d'event). */
  color: string
}

interface TickerSourceEvent {
  title: string
  type: EventType
  start_at: string
  group_id?: string | null
  groups: { name: string } | null
}

/**
 * Transforme les prochains events en labels condensés :
 * - aujourd'hui (KST) : « LIVE TONIGHT — M COUNTDOWN 18:00 KST » (dot live)
 * - à venir mv/release : « AESPA COMEBACK D-2 »
 * - à venir autre : « MUSIC BANK D-3 »
 * Le dot porte la couleur du type ; les doublons de label sont fusionnés
 * (même music show posé sur plusieurs groupes suivis).
 */
export function buildTickerItems(
  events: readonly TickerSourceEvent[],
  // timeZone = fuseau du viewer : « LIVE TONIGHT » et les D-day doivent dire la
  // même chose que la queue en dessous (l'heure affichée reste étiquetée KST).
  {
    max = 8,
    nowIso,
    timeZone = 'Asia/Seoul',
  }: { max?: number; nowIso?: string; timeZone?: string } = {},
): TickerItem[] {
  const todayKey = localDayKey(nowIso ?? new Date().toISOString(), timeZone)
  const items: TickerItem[] = []
  const seen = new Set<string>()
  const push = (item: TickerItem) => {
    if (seen.has(item.text)) return
    seen.add(item.text)
    items.push(item)
  }
  for (const e of events) {
    if (items.length >= max) break
    const isToday = localDayKey(e.start_at, timeZone) === todayKey
    const group = e.groups?.name?.toUpperCase()
    const color = EVENT_TYPE_COLORS[e.type]
    if (isToday) {
      const what = e.type === 'music_show' ? e.title : `${group ?? ''} ${e.title}`.trim()
      push({
        text: `LIVE TONIGHT — ${what.toUpperCase()} ${kstTime24h(e.start_at)} KST`,
        live: true,
        color,
      })
    } else if (e.type === 'mv' || e.type === 'release') {
      // Le nom de la release/du MV quand on l'a (retour Rudy R5) :
      // « AESPA · RICH MAN D-11 » plutôt qu'un « COMEBACK » générique.
      const song = displayEventTitle(e.title, e.groups?.name, null, e.type).toUpperCase()
      const what = song && song !== group ? `· ${song}` : 'COMEBACK'
      push({
        text: `${group ?? 'COMEBACK'} ${what} ${formatDDay(e.start_at, timeZone, nowIso)}`,
        live: false,
        color,
      })
    } else {
      const label = EVENT_TYPE_LABELS[e.type].toUpperCase()
      const subject = e.type === 'music_show' ? e.title.toUpperCase() : `${group ?? ''} ${label}`
      push({
        text: `${subject.trim()} ${formatDDay(e.start_at, timeZone, nowIso)}`,
        live: false,
        color,
      })
    }
  }
  return items
}

/**
 * Sélection des events du ticker : les annonces « qui tapent » — un event par
 * groupe, groupes triés par popularité (nb de follows global), tous types,
 * qu'on suive le groupe ou non.
 */
export function pickTickerEvents<T extends TickerSourceEvent & { group_id?: string | null }>(
  events: readonly T[],
  followCounts: ReadonlyMap<string, number>,
  max = 8,
): T[] {
  const byGroup = new Map<string, T>()
  for (const e of events) {
    const key = e.group_id ?? e.groups?.name ?? e.title
    if (!byGroup.has(key)) byGroup.set(key, e) // events triés par date → le plus proche gagne
  }
  return [...byGroup.entries()]
    .sort(
      ([a], [b]) =>
        (followCounts.get(b) ?? 0) - (followCounts.get(a) ?? 0) ||
        byGroup.get(a)!.start_at.localeCompare(byGroup.get(b)!.start_at),
    )
    .slice(0, max)
    .map(([, e]) => e)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
}
