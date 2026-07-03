// Histogramme de distribution des notes (§7.7.3) — 10 buckets 1..10.
// Demi-points arrondis au-dessus (7.5 → bucket 8) ; 0 compte dans le bucket 1.
export function bucketScores(scores: readonly number[]): number[] {
  const buckets = Array.from({ length: 10 }, () => 0)
  for (const s of scores) {
    const idx = Math.min(10, Math.max(1, Math.ceil(s))) - 1
    buckets[idx] += 1
  }
  return buckets
}
