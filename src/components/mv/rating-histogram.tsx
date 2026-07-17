import { bucketScores, bucketLabel } from '@/lib/events/rating-distribution'

// Nuance par bucket : gris (notes basses) → primary → teal (hautes). Tokens only.
// Seuils ×2 depuis le passage aux 20 buckets demi-points.
function barColor(index: number): string {
  if (index < 8) return 'color-mix(in srgb, var(--faint) 55%, transparent)'
  if (index < 14) return `color-mix(in srgb, var(--primary) ${45 + (index - 8) * 9}%, var(--faint))`
  return `color-mix(in srgb, var(--teal) ${(index - 12) * 12}%, var(--primary))`
}

// Histogramme de distribution 0.5→10 par demi-points (§7.7.3, retour Rudy
// 2026-07-17 : un 8.5 doit avoir SA barre) — signature data-forward. Server.
// A11y §8.6 : les barres sont décoratives (aria-hidden) ; le contenu accessible
// est une liste sr-only des buckets non vides (« 8.5/10 — 4 ratings »).
export function RatingHistogram({ scores }: { scores: readonly number[] }) {
  const buckets = bucketScores(scores)
  const max = Math.max(1, ...buckets)
  return (
    <div role="img" aria-label={`Rating distribution across ${scores.length} ratings`}>
      <ul className="sr-only">
        {buckets.map((count, i) =>
          count > 0 ? (
            <li key={i}>
              {bucketLabel(i)}/10 — {count} rating{count > 1 ? 's' : ''}
            </li>
          ) : null,
        )}
      </ul>
      <div className="flex h-[44px] items-end gap-[2px]" aria-hidden>
        {buckets.map((count, i) => (
          <div
            key={i}
            className="flex h-full w-[4px] flex-col justify-end"
            title={`${bucketLabel(i)}: ${count}`}
          >
            <div
              className="w-full rounded-t-[2px]"
              style={{
                height: `${Math.max(count > 0 ? 8 : 3, (count / max) * 100)}%`,
                backgroundColor:
                  count > 0 ? barColor(i) : 'color-mix(in srgb, var(--faint) 25%, transparent)',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
