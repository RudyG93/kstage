import { formatDDay, relativeTime } from '@/lib/events/date'

// Trending /groups (refonte 2026-07-11) : signal DU MOMENT, plus les follows
// cumulés (reproche Rudy — « trending c'est le groupe qui buzz, pas le plus
// suivi »). Score = imminence d'un event futur (horizon 45 j, poids 3 — plus
// c'est proche, plus ça monte) + récence d'une sortie (fenêtre 30 j, poids 2).
// Les follows ne servent plus que de départage. Chaque entrée retenue porte sa
// RAISON (sous-titre uniforme — fini la cascade event → fandom → « — »).

export const IMMINENCE_DAYS = 45
export const RECENCY_DAYS = 30

export interface TrendingSignal {
  type: string
  start_at: string
  title: string
}

export function trendingScore(
  next: TrendingSignal | undefined,
  recent: TrendingSignal | undefined,
  nowMs: number = Date.now(),
): number {
  let score = 0
  if (next) {
    const daysUntil = (Date.parse(next.start_at) - nowMs) / 86_400_000
    if (daysUntil <= IMMINENCE_DAYS) score += ((IMMINENCE_DAYS - daysUntil) / IMMINENCE_DAYS) * 3
  }
  if (recent) {
    const daysSince = (nowMs - Date.parse(recent.start_at)) / 86_400_000
    score += Math.max(0, (RECENCY_DAYS - daysSince) / RECENCY_DAYS) * 2
  }
  return score
}

export function trendingReason(
  next: TrendingSignal | undefined,
  recent: TrendingSignal | undefined,
  nowMs: number = Date.now(),
): string {
  if (next && (Date.parse(next.start_at) - nowMs) / 86_400_000 <= IMMINENCE_DAYS) {
    const dday = formatDDay(next.start_at, 'Asia/Seoul')
    return next.type === 'music_show' ? `Music show · ${dday}` : `Comeback · ${dday}`
  }
  if (recent) {
    const label = recent.type === 'mv' ? 'MV out' : 'Release'
    return `${label} · ${relativeTime(recent.start_at, nowMs)}`
  }
  return ''
}

/** Top `limit` des items « du moment » (score > 0), départagés follows puis nom. */
export function pickTrending<T extends { id: string; name: string }>(
  items: readonly T[],
  nextEvents: ReadonlyMap<string, TrendingSignal>,
  recentReleases: ReadonlyMap<string, TrendingSignal>,
  followsOf: (id: string) => number,
  limit = 5,
  nowMs: number = Date.now(),
): { item: T; reason: string }[] {
  const scoreOf = (id: string) => trendingScore(nextEvents.get(id), recentReleases.get(id), nowMs)
  return items
    .filter((g) => scoreOf(g.id) > 0)
    .sort(
      (a, b) =>
        scoreOf(b.id) - scoreOf(a.id) ||
        followsOf(b.id) - followsOf(a.id) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
    .map((item) => ({
      item,
      reason: trendingReason(nextEvents.get(item.id), recentReleases.get(item.id), nowMs),
    }))
}
