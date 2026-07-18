import { describe, it, expect } from 'vitest'
import { resolveNearDup, shouldUpgradeTitle, type NearDupRow } from './comeback-ingest'

const DAY = 86_400_000
const WINDOW = 3 * DAY

const near = (over: Partial<NearDupRow> = {}): NearDupRow => ({
  id: 'e1',
  t: Date.parse('2026-08-01T15:00:00Z'),
  status: 'tentative',
  imageUrl: null,
  title: 'Some Single',
  ...over,
})

// Upgrade de titre (round 2026-07-18, cas OURBIRTHDAY) : le placeholder
// « {groupe} debut » prend le vrai nom du single quand la source l'apporte.
describe('shouldUpgradeTitle', () => {
  it('upgrade un placeholder vers un vrai titre', () => {
    expect(shouldUpgradeTitle('OURBIRTHDAY debut', 'Candy Bomb', 'OURBIRTHDAY')).toBe(true)
  })
  it('ne touche jamais un titre déjà réel', () => {
    expect(shouldUpgradeTitle('Candy Bomb', 'Autre Titre', 'OURBIRTHDAY')).toBe(false)
  })
  it("n'upgrade pas placeholder → placeholder ni vers un titre vide", () => {
    expect(shouldUpgradeTitle('OURBIRTHDAY debut', 'ourbirthday Debut', 'OURBIRTHDAY')).toBe(false)
    expect(shouldUpgradeTitle('OURBIRTHDAY debut', '', 'OURBIRTHDAY')).toBe(false)
    expect(shouldUpgradeTitle('OURBIRTHDAY debut', null, 'OURBIRTHDAY')).toBe(false)
  })
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
