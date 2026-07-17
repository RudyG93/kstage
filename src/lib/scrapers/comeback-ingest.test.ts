import { describe, it, expect } from 'vitest'
import { resolveNearDup, type NearDupRow } from './comeback-ingest'

const DAY = 86_400_000
const WINDOW = 3 * DAY

const near = (over: Partial<NearDupRow> = {}): NearDupRow => ({
  id: 'e1',
  t: Date.parse('2026-08-01T15:00:00Z'),
  status: 'tentative',
  imageUrl: null,
  ...over,
})

// Fusion des annonces plus précises (Phase 3 Lot 4) : une tentative (minuit
// KST technique, ex. wikipedia) doit être PROMUE quand la source précise
// (kpopofficial, heure exacte, confirmed) arrive — pas ignorée à jamais.
describe('resolveNearDup', () => {
  it('aucun near dans la fenêtre → insert', () => {
    const candidate = { startAt: '2026-08-10T09:00:00Z', status: 'confirmed' }
    expect(resolveNearDup(candidate, [near()], WINDOW)).toBe('insert')
  })

  it('candidat confirmed vs near tentative → upgrade (id + image du near)', () => {
    const candidate = { startAt: '2026-08-02T09:00:00Z', status: 'confirmed' }
    expect(resolveNearDup(candidate, [near()], WINDOW)).toEqual({
      upgradeId: 'e1',
      imageUrl: null,
    })
  })

  it('confirmed vs confirmed → skip (comportement historique)', () => {
    const candidate = { startAt: '2026-08-02T09:00:00Z', status: 'confirmed' }
    expect(resolveNearDup(candidate, [near({ status: 'confirmed' })], WINDOW)).toBe('skip')
  })

  it('candidat tentative vs near confirmed → skip (jamais de downgrade)', () => {
    const candidate = { startAt: '2026-08-02T09:00:00Z', status: 'tentative' }
    expect(resolveNearDup(candidate, [near({ status: 'confirmed' })], WINDOW)).toBe('skip')
  })

  it('idempotence du 2ᵉ run : le near promu (confirmed) → skip, pas de yo-yo', () => {
    const candidate = { startAt: '2026-08-02T09:00:00Z', status: 'confirmed' }
    const first = resolveNearDup(candidate, [near()], WINDOW)
    expect(first).toHaveProperty('upgradeId')
    // Après l'upgrade, le near est confirmed à la nouvelle heure.
    const afterUpgrade = [near({ status: 'confirmed', t: Date.parse(candidate.startAt) })]
    expect(resolveNearDup(candidate, afterUpgrade, WINDOW)).toBe('skip')
  })
})
