import { describe, it, expect } from 'vitest'

// Pure logic d'agrégation (la query Supabase est mockée par le test e2e).
// On extrait la formule pour la tester isolément.
function computeAvg(scores: number[]): number | null {
  return scores.length === 0 ? null : scores.reduce((a, b) => a + b, 0) / scores.length
}

describe('rating aggregation', () => {
  it('moyenne sur plusieurs notes', () => {
    expect(computeAvg([8, 9, 10])).toBe(9)
    expect(computeAvg([5, 7])).toBe(6)
  })

  it('null si aucun vote (ghost-town)', () => {
    expect(computeAvg([])).toBeNull()
  })

  it('arrondi naturel JS sur moyenne non entière', () => {
    // 8 + 9 + 7 = 24 / 3 = 8 ; 8 + 7 = 15 / 2 = 7.5
    expect(computeAvg([8, 9, 7])).toBe(8)
    expect(computeAvg([8, 7])).toBe(7.5)
  })
})
