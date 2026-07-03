import { createClient } from '@/lib/supabase/server'

// TOP RATED — THIS WEEK (§7.4.2) : agrégation en TS depuis event_ratings
// (pas de GROUP BY PostgREST ; volume faible). Fns pures testées.

export interface RatingRow {
  event_id: string
  score: number
  created_at: string
}

export interface RatedEntry {
  eventId: string
  avg: number
  count: number
}

export type RankDelta = { kind: 'up' | 'down' | 'same' | 'new'; n: number }

/** Agrège les notes posées dans [fromIso, toIso), seuil minimal de votes. */
export function aggregateWindow(
  rows: readonly RatingRow[],
  fromIso: string,
  toIso: string,
  minCount = 2,
): RatedEntry[] {
  const byEvent = new Map<string, { sum: number; count: number }>()
  for (const r of rows) {
    if (r.created_at < fromIso || r.created_at >= toIso) continue
    const agg = byEvent.get(r.event_id) ?? { sum: 0, count: 0 }
    agg.sum += r.score
    agg.count += 1
    byEvent.set(r.event_id, agg)
  }
  return [...byEvent.entries()]
    .map(([eventId, { sum, count }]) => ({ eventId, avg: sum / count, count }))
    .filter((e) => e.count >= minCount)
    .sort((a, b) => b.avg - a.avg || b.count - a.count || a.eventId.localeCompare(b.eventId))
}

/** Delta de rang vs la fenêtre précédente : ▲n / ▼n / — / NEW. */
export function computeRankDeltas(
  current: readonly RatedEntry[],
  previous: readonly RatedEntry[],
): Map<string, RankDelta> {
  const prevRank = new Map(previous.map((e, i) => [e.eventId, i]))
  const out = new Map<string, RankDelta>()
  current.forEach((e, i) => {
    const prev = prevRank.get(e.eventId)
    if (prev === undefined) {
      out.set(e.eventId, { kind: 'new', n: 0 })
    } else if (prev === i) {
      out.set(e.eventId, { kind: 'same', n: 0 })
    } else {
      out.set(e.eventId, prev > i ? { kind: 'up', n: prev - i } : { kind: 'down', n: i - prev })
    }
  })
  return out
}

export interface TopRatedItem extends RatedEntry {
  delta: RankDelta
  title: string
  slug: string | null
  groupName: string | null
}

/**
 * Top des MV/releases les mieux notés cette semaine (fenêtre 7 j glissante,
 * delta vs les 7 j précédents). Repli tout-temps (deltas « — ») quand la
 * semaine est trop calme pour un chart honnête (< 3 entrées).
 */
export async function getTopRatedThisWeek(limit = 5): Promise<{
  items: TopRatedItem[]
  scope: 'week' | 'alltime'
}> {
  const supabase = await createClient()
  const now = Date.now()
  const weekAgo = new Date(now - 7 * 86_400_000).toISOString()
  const twoWeeksAgo = new Date(now - 14 * 86_400_000).toISOString()
  const nowIso = new Date(now).toISOString()

  const { data: recent } = await supabase
    .from('event_ratings')
    .select('event_id, score, created_at')
    .gte('created_at', twoWeeksAgo)
  const rows = recent ?? []

  let scope: 'week' | 'alltime' = 'week'
  let entries = aggregateWindow(rows, weekAgo, nowIso).slice(0, limit)
  let deltas = computeRankDeltas(entries, aggregateWindow(rows, twoWeeksAgo, weekAgo))

  if (entries.length < 3) {
    // Semaine creuse → top tout-temps, sans deltas (pas d'historique honnête).
    scope = 'alltime'
    const { data: all } = await supabase.from('event_ratings').select('event_id, score, created_at')
    entries = aggregateWindow(all ?? [], '0000', '9999', 1).slice(0, limit)
    deltas = new Map(entries.map((e) => [e.eventId, { kind: 'same', n: 0 } as RankDelta]))
  }
  if (entries.length === 0) return { items: [], scope }

  const { data: events } = await supabase
    .from('events')
    .select('id, title, slug, groups!inner(name)')
    .in(
      'id',
      entries.map((e) => e.eventId),
    )
  const eventById = new Map((events ?? []).map((e) => [e.id, e]))

  const items = entries.flatMap((e) => {
    const event = eventById.get(e.eventId)
    if (!event) return []
    return [
      {
        ...e,
        delta: deltas.get(e.eventId) ?? ({ kind: 'same', n: 0 } as RankDelta),
        title: event.title,
        slug: event.slug,
        groupName: event.groups?.name ?? null,
      },
    ]
  })
  return { items, scope }
}
