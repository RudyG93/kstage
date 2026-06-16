import { describe, it, expect } from 'vitest'
import { nextWeeklySlotIso, kstDateTimeToIso } from './slots'

// Référence : 2026-06-15 est un LUNDI (weekday 1). Les créneaux KST des shows
// sont définis dans SHOW_DESCRIPTORS (the-show=mardi 18:00, music-bank=vendredi
// 17:00, inkigayo=dimanche 15:25). KST = UTC+9.

describe('nextWeeklySlotIso', () => {
  it('renvoie le créneau de cette semaine quand il est encore à venir', () => {
    const now = new Date('2026-06-15T00:00:00.000Z') // lundi 09:00 KST
    // music-bank : vendredi 17:00 KST → 08:00 UTC, le 2026-06-19.
    expect(nextWeeklySlotIso('music-bank', now)).toBe('2026-06-19T08:00:00.000Z')
    // the-show : mardi 18:00 KST → 09:00 UTC, le 2026-06-16.
    expect(nextWeeklySlotIso('the-show', now)).toBe('2026-06-16T09:00:00.000Z')
    // inkigayo : dimanche 15:25 KST → 06:25 UTC, le 2026-06-21.
    expect(nextWeeklySlotIso('inkigayo', now)).toBe('2026-06-21T06:25:00.000Z')
  })

  it('garde le créneau du jour quand il vient de passer (tolérance 12 h, cron 22:00 KST)', () => {
    // music-bank vendredi 08:00 UTC ; now = vendredi 14:00 UTC (6 h après).
    const now = new Date('2026-06-19T14:00:00.000Z')
    expect(nextWeeklySlotIso('music-bank', now)).toBe('2026-06-19T08:00:00.000Z')
  })

  it('bascule sur la semaine suivante une fois le jour du créneau dépassé', () => {
    // now = samedi 2026-06-20 → le prochain music-bank est le vendredi suivant.
    const now = new Date('2026-06-20T03:00:00.000Z') // samedi 12:00 KST
    expect(nextWeeklySlotIso('music-bank', now)).toBe('2026-06-26T08:00:00.000Z')
  })

  it('throw sur un show inconnu', () => {
    // @ts-expect-error test runtime guard
    expect(() => nextWeeklySlotIso('not-a-show', new Date('2026-06-15T00:00:00Z'))).toThrow()
  })
})

describe('kstDateTimeToIso', () => {
  it('convertit une horloge KST en UTC (-9 h)', () => {
    expect(kstDateTimeToIso(2026, 6, 15, 18, 0)).toBe('2026-06-15T09:00:00.000Z')
  })

  it('gère minuit KST (jour précédent en UTC)', () => {
    expect(kstDateTimeToIso(2026, 6, 15, 0, 0)).toBe('2026-06-14T15:00:00.000Z')
  })

  it('renvoie null sur mois / jour hors bornes', () => {
    expect(kstDateTimeToIso(2026, 13, 1, 12, 0)).toBeNull()
    expect(kstDateTimeToIso(2026, 0, 1, 12, 0)).toBeNull()
    expect(kstDateTimeToIso(2026, 6, 40, 12, 0)).toBeNull()
    expect(kstDateTimeToIso(2026, 6, 0, 12, 0)).toBeNull()
  })

  it('renvoie null sur heure / minute hors bornes', () => {
    expect(kstDateTimeToIso(2026, 6, 15, 24, 0)).toBeNull()
    expect(kstDateTimeToIso(2026, 6, 15, -1, 0)).toBeNull()
    expect(kstDateTimeToIso(2026, 6, 15, 12, 60)).toBeNull()
    expect(kstDateTimeToIso(2026, 6, 15, 12, -1)).toBeNull()
  })
})
