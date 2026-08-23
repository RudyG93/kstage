import { describe, expect, it } from 'vitest'
import { activityLabel, activityStatus } from './activity'

const NOW = Date.parse('2026-08-21T00:00:00Z')
const monthsAgo = (n: number) => new Date(NOW - n * 30.44 * 86_400_000).toISOString()

describe('activityStatus', () => {
  it('sortie récente → actif', () => {
    expect(activityStatus(monthsAgo(0), NOW)).toBe('active')
    expect(activityStatus(monthsAgo(11), NOW)).toBe('active')
  })

  it('12 à 24 mois → en pause', () => {
    // Cas réel : un groupe entre deux ères, service militaire, préparation.
    expect(activityStatus(monthsAgo(13), NOW)).toBe('paused')
    expect(activityStatus(monthsAgo(23), NOW)).toBe('paused')
  })

  it('plus de 24 mois → dormant', () => {
    expect(activityStatus(monthsAgo(25), NOW)).toBe('dormant')
    expect(activityStatus(monthsAgo(60), NOW)).toBe('dormant')
  })

  it('aucune sortie connue → dormant', () => {
    expect(activityStatus(null, NOW)).toBe('dormant')
    expect(activityStatus(undefined, NOW)).toBe('dormant')
    expect(activityStatus('pas une date', NOW)).toBe('dormant')
  })

  it('NewJeans (dernière sortie 2024-07) est en pause/dormant, pas actif', () => {
    expect(activityStatus('2024-07-04T00:00:00Z', NOW)).toBe('dormant')
  })
})

describe('activityLabel', () => {
  it("n'étiquette pas les actifs (pas de bruit visuel)", () => {
    expect(activityLabel('active')).toBeNull()
  })
  it('étiquette les autres', () => {
    expect(activityLabel('paused')).toBe('On hiatus')
    expect(activityLabel('dormant')).toBe('Inactive')
  })

  // Garde anti-récidive : ces deux libellés sont rendus sur des tuiles
  // publiques et sont restés en français six passes d'audit durant, parce
  // qu'ils vivent sous la ligne de flottaison de /groups.
  it("l'UI publique ne rend pas de français", () => {
    for (const status of ['active', 'paused', 'dormant'] as const) {
      expect(activityLabel(status) ?? '').not.toMatch(/[àâäéèêëîïôöùûüçœ]/i)
    }
  })
})
