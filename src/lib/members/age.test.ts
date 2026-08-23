import { describe, it, expect } from 'vitest'
import { ageFromBirthday } from './queries'

// L'âge se comptait en années de 365,25 jours : la dérive dépend du nombre
// RÉEL de bissextiles vécues, et 564 des 2 037 couples (membre, année) mesurés
// en prod le 2026-08-23 tombaient un an trop bas le jour de l'anniversaire.
describe('ageFromBirthday', () => {
  const midiKst = (iso: string) => Date.parse(`${iso}T03:00:00.000Z`)

  it("bascule le jour même de l'anniversaire, pas des jours plus tard", () => {
    // Haechan, 2000-06-06 : il a 26 ans le 2026-06-06.
    expect(ageFromBirthday('2000-06-06', midiKst('2026-06-05'))).toBe(25)
    expect(ageFromBirthday('2000-06-06', midiKst('2026-06-06'))).toBe(26)
  })

  it('tient sur une naissance un 29 février', () => {
    expect(ageFromBirthday('2004-02-29', midiKst('2026-02-28'))).toBe(21)
    expect(ageFromBirthday('2004-02-29', midiKst('2026-03-01'))).toBe(22)
  })

  it('ancre le jour en KST : minuit à Séoul fait basculer, pas minuit UTC', () => {
    // 2026-06-06 00:30 KST = 2026-06-05 15:30 UTC.
    expect(ageFromBirthday('2000-06-06', Date.parse('2026-06-05T15:30:00.000Z'))).toBe(26)
  })

  it('refuse une date absente ou illisible', () => {
    expect(ageFromBirthday(null)).toBeNull()
    expect(ageFromBirthday('pas-une-date')).toBeNull()
  })

  it('rejette les valeurs hors bornes plausibles', () => {
    expect(ageFromBirthday('1850-01-01', midiKst('2026-01-01'))).toBeNull()
    expect(ageFromBirthday('2030-01-01', midiKst('2026-01-01'))).toBeNull()
  })
})
