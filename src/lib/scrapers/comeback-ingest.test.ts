import { describe, it, expect } from 'vitest'
import {
  isUntitledRelease,
  resolveNearDup,
  shouldUpgradeTitle,
  type NearDupRow,
} from './comeback-ingest'

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

describe('isUntitledRelease — descripteur de format vs vrai nom (2026-08-22)', () => {
  const descripteurs = [
    'NCT 127 7th Full Album (2026)',
    'SF9 2nd Album (2026)',
    'BOYNEXTDOOR 2nd Japanese Digital Single (2026)',
    'ATEEZ Japan 5th Single (2026)',
    'ARTMS Pre-release Single (2026)',
    '82MAJOR Comeback Coming Soon (2026)',
  ]
  it.each(descripteurs)('reconnait « %s » comme non titré', (t) => {
    expect(isUntitledRelease(t)).toBe(true)
  })

  const vraisTitres = [
    // kpopofficial une fois l'album nommé
    'NCT 127 7th Album – BLINGY (2026)',
    'NEXZ 4th Mini Album – SAUCIN’ (2026)',
    'SF9 2nd Album – TENACITY (2026)',
    'MINHO (SHINee) 2nd Mini Album – Make it hot (2026)',
    // Wikipedia : des noms nus, SANS tiret — c'est pourquoi la règle ne peut
    // pas être « le titre n'a pas de tiret ».
    'Mark on Me',
    'Blue Mode',
    'This & That',
    'Flavor',
    'PHASE 1: Soft Violence',
    // fandom
    'Hungry (Side A)',
  ]
  it.each(vraisTitres)('laisse passer « %s »', (t) => {
    expect(isUntitledRelease(t)).toBe(false)
  })
})

describe('shouldUpgradeTitle — cas NCT 127 / BLINGY', () => {
  it('remplace le descripteur de format par le nom de l’album', () => {
    expect(
      shouldUpgradeTitle(
        'NCT 127 7th Full Album (2026)',
        'NCT 127 7th Album – BLINGY (2026)',
        'NCT 127',
      ),
    ).toBe(true)
  })

  it('ne remplace jamais un vrai titre par un descripteur', () => {
    expect(
      shouldUpgradeTitle(
        'NCT 127 7th Album – BLINGY (2026)',
        'NCT 127 7th Full Album (2026)',
        'NCT 127',
      ),
    ).toBe(false)
  })

  it('garde le comportement historique sur « {groupe} debut »', () => {
    expect(
      shouldUpgradeTitle(
        'OURBIRTHDAY debut',
        'OURBIRTHDAY 1st Single – Our Birthday (2026)',
        'OURBIRTHDAY',
      ),
    ).toBe(true)
  })
})
