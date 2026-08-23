import { describe, it, expect } from 'vitest'
import { bucketByReleaseWindow, type RatedEventAgg } from './top-rated'
import { MIN_RATINGS_SHOWN } from './labels'

// Sémantique 2026-07-11 : les périodes fenêtrent la date de SORTIE du MV
// (start_at), pas la date de pose des notes. Fixtures calquées sur l'état
// prod du 2026-07-11 (5 MVs notés, 1 vote chacun).
const NOW = Date.parse('2026-07-11T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

// Le seuil par défaut est MIN_RATINGS_SHOWN, le MÊME que celui qui décide
// d'afficher une moyenne sur la page d'un MV (2026-08-23) : à 2, le classement
// listait des clips dont la page refusait ensuite de montrer un score.
const agg = (
  id: string,
  avg: number,
  releasedDaysAgo: number,
  count = MIN_RATINGS_SHOWN,
): RatedEventAgg => ({
  eventId: id,
  avg,
  count,
  releaseAt: daysAgo(releasedDaysAgo),
  title: id,
  slug: id,
  groupName: 'g',
  groupImage: null,
})

describe('bucketByReleaseWindow', () => {
  // ≈ prod : LEMONADE Remix (40 j, 8.5), QWER (656 j, 8.5), Mono (165 j, 5.0),
  // Crow (27 j, 7.0), Do your dance (26 j, 8.0).
  const PROD = [
    agg('lemonade', 8.5, 40),
    agg('qwer', 8.5, 656),
    agg('mono', 5.0, 165),
    agg('crow', 7.0, 27),
    agg('dance', 8.0, 26),
  ]

  it('month = sortis ≤ 30 j, year exclut le 656 j, alltime = tout', () => {
    const b = bucketByReleaseWindow(PROD, NOW)
    expect(b.month.map((i) => i.eventId)).toEqual(['dance', 'crow'])
    expect(b.year.map((i) => i.eventId)).toEqual(['lemonade', 'dance', 'crow', 'mono'])
    expect(b.alltime.map((i) => i.eventId)).toEqual(['lemonade', 'qwer', 'dance', 'crow', 'mono'])
  })

  it('tri : moyenne desc, puis nb de votes, puis id (déterministe)', () => {
    const b = bucketByReleaseWindow([agg('a', 8, 5), agg('b', 8, 5, 4), agg('c', 9, 5)], NOW)
    expect(b.month.map((i) => i.eventId)).toEqual(['c', 'b', 'a'])
  })

  it('badge New pour les sorties < 7 j, — sinon', () => {
    const b = bucketByReleaseWindow([agg('fresh', 8, 2), agg('old', 9, 20)], NOW)
    expect(b.month.find((i) => i.eventId === 'fresh')?.delta.kind).toBe('new')
    expect(b.month.find((i) => i.eventId === 'old')?.delta.kind).toBe('same')
  })

  it('respecte limit et minCount', () => {
    const many = Array.from({ length: 8 }, (_, i) => agg(`e${i}`, 5 + i * 0.1, 3))
    expect(bucketByReleaseWindow(many, NOW, 5).month).toHaveLength(5)
    const b = bucketByReleaseWindow([agg('solo', 8, 3, 1)], NOW, 5, 2)
    expect(b.alltime).toHaveLength(0)
  })

  it('le seuil par défaut est celui de la page MV : sous MIN_RATINGS_SHOWN, pas de classement', () => {
    const b = bucketByReleaseWindow(
      [agg('sous-seuil', 9.5, 3, MIN_RATINGS_SHOWN - 1), agg('au-seuil', 7, 3, MIN_RATINGS_SHOWN)],
      NOW,
    )
    expect(b.month.map((i) => i.eventId)).toEqual(['au-seuil'])
  })

  it('fenêtres vides → tableaux vides (pas de throw)', () => {
    const b = bucketByReleaseWindow([agg('vieux', 8, 400)], NOW)
    expect(b.month).toEqual([])
    expect(b.year).toEqual([])
    expect(b.alltime.map((i) => i.eventId)).toEqual(['vieux'])
  })
})

// Les tests de bucketScores vivent désormais avec le module :
// src/lib/events/rating-distribution.test.ts (20 buckets demi-points, 2026-07-17).
