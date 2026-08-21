/**
 * Statut d'activité d'un artiste, dérivé de sa DERNIÈRE SORTIE (2026-08-21).
 *
 * Question de Rudy : « on a trop de groupes, beaucoup d'inactifs ». Les chiffres
 * ont nuancé — 200 des 256 groupes ont sorti quelque chose dans les 12 mois, et
 * les « inactifs » ne sont pas des inconnus : NewJeans (hiatus judiciaire), iKON,
 * FTISLAND, PENTAGON en font partie. Les supprimer serait une régression pour un
 * fan qui les cherche.
 *
 * Le vrai défaut est l'absence de HIÉRARCHIE : dans l'annuaire, rien ne
 * distingue un groupe qui sort un comeback ce mois-ci d'un autre silencieux
 * depuis trois ans. On classe donc au lieu de supprimer — c'est réversible, et
 * un groupe dormant reste accessible par la recherche et par son URL.
 *
 * Les seuils sont volontairement larges : en k-pop, 12 mois entre deux sorties
 * est courant (service militaire, préparation d'album, tournée).
 */
export type ActivityStatus = 'active' | 'paused' | 'dormant'

export const PAUSED_AFTER_MONTHS = 12
export const DORMANT_AFTER_MONTHS = 24

const MONTH_MS = 30.44 * 86_400_000

/**
 * `active` : sortie il y a moins de 12 mois · `paused` : 12 à 24 mois ·
 * `dormant` : plus de 24 mois, ou aucune sortie connue.
 */
export function activityStatus(
  lastReleaseAt: string | null | undefined,
  nowMs: number = Date.now(),
): ActivityStatus {
  if (!lastReleaseAt) return 'dormant'
  const ts = Date.parse(lastReleaseAt)
  if (Number.isNaN(ts)) return 'dormant'
  const months = (nowMs - ts) / MONTH_MS
  if (months < PAUSED_AFTER_MONTHS) return 'active'
  if (months < DORMANT_AFTER_MONTHS) return 'paused'
  return 'dormant'
}

/** Ordre de mise en avant : actifs, puis en pause, puis dormants. */
export const ACTIVITY_RANK: Record<ActivityStatus, number> = {
  active: 0,
  paused: 1,
  dormant: 2,
}

/** Libellé affiché sur une tuile — `null` pour les actifs (pas de bruit visuel). */
export function activityLabel(status: ActivityStatus): string | null {
  if (status === 'paused') return 'En pause'
  if (status === 'dormant') return 'Inactif'
  return null
}
