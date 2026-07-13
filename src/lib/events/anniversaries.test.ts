import { describe, it, expect } from 'vitest'
import { generateAnniversaries } from './anniversaries'
import { kstDayKey } from './date'

const group = (over: Partial<Parameters<typeof generateAnniversaries>[0][number]> = {}) => ({
  id: 'g1',
  slug: 'aespa',
  name: 'aespa',
  color_hex: null,
  image_url: null,
  image_landscape: null,
  banner_url: null,
  debut_date: null,
  is_solo: false,
  ...over,
})

describe('generateAnniversaries', () => {
  it('ne génère AUCUN event de debut anniversary même si debut_date est dans la fenêtre', () => {
    // Décision produit : on ne publie plus les anniversaires de debut.
    const res = generateAnniversaries([group({ debut_date: '2020-11-17' })], [], {
      todayKey: '2026-11-01',
      days: 30,
    })
    expect(res).toHaveLength(0)
  })

  it('birthday de soliste : âge seul, pas de "(groupe)"', () => {
    const res = generateAnniversaries(
      [group({ id: 's1', slug: 'iu', name: 'IU' })],
      [{ group_id: 's1', stage_name: 'IU', birthday: '1993-05-16' }],
      { todayKey: '2026-05-10', days: 30 },
    )
    expect(res).toHaveLength(1)
    expect(res[0].title).toBe('33')
    expect(res[0].type).toBe('anniversary')
    expect(kstDayKey(res[0].start_at)).toBe('2026-05-16')
  })

  it('birthday de membre de groupe affiche stage_name + âge', () => {
    const res = generateAnniversaries(
      [group({ debut_date: null })],
      [{ group_id: 'g1', stage_name: 'Karina', birthday: '2000-04-11' }],
      { todayKey: '2026-04-01', days: 30 },
    )
    expect(res[0].title).toBe('Karina — 26')
  })

  it('exclut un birthday hors fenêtre', () => {
    const res = generateAnniversaries(
      [group()],
      [{ group_id: 'g1', stage_name: 'Karina', birthday: '2000-04-11' }],
      { todayKey: '2026-11-01', days: 30 },
    )
    expect(res).toHaveLength(0)
  })

  it("passe à l'année suivante si la date est déjà passée", () => {
    const res = generateAnniversaries(
      [group()],
      [{ group_id: 'g1', stage_name: 'Karina', birthday: '2000-01-05' }],
      { todayKey: '2026-12-20', days: 30 },
    )
    expect(res).toHaveLength(1)
    expect(kstDayKey(res[0].start_at)).toBe('2027-01-05')
    expect(res[0].title).toBe('Karina — 27')
  })

  it('dédup soliste+membre (Hwasa) : un seul anniv, version groupe préférée (R8)', () => {
    const res = generateAnniversaries(
      [
        group({ id: 'mmm', slug: 'mamamoo', name: 'MAMAMOO', is_solo: false }),
        group({ id: 'hw', slug: 'hwasa', name: 'Hwasa', is_solo: true }),
      ],
      [
        { group_id: 'mmm', stage_name: 'Hwasa', birthday: '1995-07-23' },
        { group_id: 'hw', stage_name: 'Hwasa', birthday: '1995-07-23' },
      ],
      { todayKey: '2026-07-01', days: 60 },
    )
    expect(res).toHaveLength(1)
    // Row du groupe non-solo gardée → « Hwasa — 31 » (pas le « 31 » nu du solo).
    expect(res[0].title).toBe('Hwasa — 31')
    expect(res[0].groups.slug).toBe('mamamoo')
  })
})
