// Histogramme de distribution des notes (§7.7.3) — 20 buckets demi-points
// 0.5 → 10.0 (retour Rudy 2026-07-17 : un 8.5 gonflait la barre du 9 via
// Math.ceil). Le 0, légal en DB (numeric [0,10] depuis 0028), est fusionné
// dans la première barre plutôt que d'avoir une barre fantôme quasi vide.
export const BUCKET_COUNT = 20

export function bucketScores(scores: readonly number[]): number[] {
  const buckets = Array.from({ length: BUCKET_COUNT }, () => 0)
  for (const s of scores) {
    const idx = Math.min(BUCKET_COUNT, Math.max(1, Math.round(s * 2))) - 1
    buckets[idx] += 1
  }
  return buckets
}

/** Note représentée par le bucket i : 0 → « 0.5 », 15 → « 8 », 16 → « 8.5 ». */
export function bucketLabel(index: number): string {
  const value = (index + 1) / 2
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
