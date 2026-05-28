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
  ...over,
})

describe('generateAnniversaries', () => {
  it('génère un anniversaire de debut dans la fenêtre (jour KST correct)', () => {
    const res = generateAnniversaries([group({ debut_date: '2020-11-17' })], [], {
      todayKey: '2026-11-01',
      days: 30,
    })
    expect(res).toHaveLength(1)
    expect(res[0].title).toBe('Debut anniversary')
    expect(res[0].type).toBe('anniversary')
    expect(kstDayKey(res[0].start_at)).toBe('2026-11-17')
  })

  it('exclut une occurrence hors fenêtre', () => {
    const res = generateAnniversaries([group({ debut_date: '2020-03-09' })], [], {
      todayKey: '2026-11-01',
      days: 30,
    })
    expect(res).toHaveLength(0)
  })

  it("passe à l'année suivante si la date est déjà passée", () => {
    const res = generateAnniversaries([group({ debut_date: '2020-01-05' })], [], {
      todayKey: '2026-12-20',
      days: 30,
    })
    expect(res).toHaveLength(1)
    expect(kstDayKey(res[0].start_at)).toBe('2027-01-05')
  })

  it('birthday de soliste : pas de "(groupe)"', () => {
    const res = generateAnniversaries(
      [group({ id: 's1', slug: 'iu', name: 'IU' })],
      [{ group_id: 's1', stage_name: 'IU', birthday: '1993-05-16' }],
      { todayKey: '2026-05-10', days: 30 },
    )
    expect(res.some((e) => e.title === 'Birthday')).toBe(true)
  })

  it('birthday de membre de groupe affiche "(groupe)"', () => {
    const res = generateAnniversaries(
      [group({ debut_date: null })],
      [{ group_id: 'g1', stage_name: 'Karina', birthday: '2000-04-11' }],
      { todayKey: '2026-04-01', days: 30 },
    )
    expect(res[0].title).toBe('Karina — birthday')
  })
})
