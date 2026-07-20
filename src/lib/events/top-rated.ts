import { createClient } from '@/lib/supabase/server'

// TOP RATED (§7.4.2, refonte périodes 2026-07-11) : agrégation en TS depuis
// event_ratings (pas de GROUP BY PostgREST ; volume faible). Fns pures testées.
//
// SÉMANTIQUE : « Top rated this month » = MVs SORTIS dans la fenêtre
// (events.start_at), classés par la moyenne de TOUTES leurs notes — le sens
// k-pop attendu. L'ancienne version fenêtrait sur la date de POSE des notes
// (created_at), ce qui rendait Month/Year/All-time indiscernables.
// Périodes : Month (30 j) · Year (365 j) · All-time. « Week » abandonnée :
// structurellement vide à l'échelle actuelle (0 MV noté sorti sur 7 j).

export type TopRatedPeriod = 'month' | 'year' | 'alltime'

export type RankDelta = { kind: 'up' | 'down' | 'same' | 'new'; n: number }

export interface TopRatedItem {
  eventId: string
  avg: number
  count: number
  releaseAt: string
  delta: RankDelta
  title: string
  slug: string | null
  groupName: string | null
  groupImage: string | null
}

export interface RatedEventAgg {
  eventId: string
  avg: number
  count: number
  releaseAt: string
  title: string
  slug: string | null
  groupName: string | null
  groupImage: string | null
}

const DAY_MS = 86_400_000
const PERIOD_DAYS: Record<Exclude<TopRatedPeriod, 'alltime'>, number> = {
  month: 30,
  year: 365,
}
// « New » = sorti il y a moins de 7 j (marqueur d'entrée fraîche — les deltas
// de rang n'ont pas de sens sous la sémantique « sortis dans la fenêtre » :
// deux mois consécutifs contiennent des sorties différentes).
const NEW_DAYS = 7

/**
 * Classe les events notés par moyenne (puis nb de votes), par période de sortie.
 * `minCount = 2` (audit §8.7) : un MV noté UNE fois ne peut plus être n°1.
 * Pas de moyenne bayésienne à ce volume — le prior dominerait tout le
 * classement ; à revisiter quand une période porte ~50+ notes.
 */
export function bucketByReleaseWindow(
  aggs: readonly RatedEventAgg[],
  nowMs: number = Date.now(),
  limit = 5,
  minCount = 2,
): Record<TopRatedPeriod, TopRatedItem[]> {
  const ranked = [...aggs]
    .filter((a) => a.count >= minCount)
    .sort((a, b) => b.avg - a.avg || b.count - a.count || a.eventId.localeCompare(b.eventId))
    .map((a): TopRatedItem => ({
      ...a,
      delta:
        nowMs - Date.parse(a.releaseAt) <= NEW_DAYS * DAY_MS
          ? { kind: 'new', n: 0 }
          : { kind: 'same', n: 0 },
    }))
  const within = (days: number) => (i: TopRatedItem) =>
    nowMs - Date.parse(i.releaseAt) <= days * DAY_MS
  return {
    month: ranked.filter(within(PERIOD_DAYS.month)).slice(0, limit),
    year: ranked.filter(within(PERIOD_DAYS.year)).slice(0, limit),
    alltime: ranked.slice(0, limit),
  }
}

/**
 * Top des MV/releases les mieux notés par période de sortie. Un seul fetch
 * (event_ratings joint aux events) : le volume de notes est minuscule et la
 * branche all-time chargeait déjà tout.
 */
export async function getTopRatedByPeriods(
  limit = 5,
): Promise<Record<TopRatedPeriod, TopRatedItem[]>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('event_ratings')
    .select(
      'event_id, score, events!inner(id, title, slug, start_at, type, groups!inner(name, image_url))',
    )
    .in('events.type', ['mv', 'release'])
    .eq('events.hidden', false)

  const byEvent = new Map<string, RatedEventAgg & { sum: number }>()
  for (const r of data ?? []) {
    const e = r.events
    if (!e) continue
    const agg = byEvent.get(r.event_id) ?? {
      eventId: r.event_id,
      sum: 0,
      count: 0,
      avg: 0,
      releaseAt: e.start_at,
      title: e.title,
      slug: e.slug,
      groupName: e.groups?.name ?? null,
      groupImage: e.groups?.image_url ?? null,
    }
    agg.sum += r.score
    agg.count += 1
    byEvent.set(r.event_id, agg)
  }
  const aggs = [...byEvent.values()].map(({ sum: _sum, ...a }) => ({
    ...a,
    avg: a.count > 0 ? _sum / a.count : 0,
  }))
  return bucketByReleaseWindow(aggs, Date.now(), limit)
}
