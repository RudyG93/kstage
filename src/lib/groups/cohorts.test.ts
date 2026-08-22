import { describe, expect, it } from 'vitest'
import { monthYear } from './cohorts'

describe('monthYear', () => {
  it('rend mois + année de la date pure', () => {
    expect(monthYear('2024-03-15')).toBe('MAR 2024')
  })

  it("ne recule pas d'un mois sur un debut du 1er", () => {
    // Le piège : new Date('2024-03-01') est minuit UTC, qu'un formateur en
    // heure locale négative rendrait « FEB 2024 ».
    expect(monthYear('2024-03-01')).toBe('MAR 2024')
    expect(monthYear('2026-01-01')).toBe('JAN 2026')
  })

  it('accepte un timestamp complet', () => {
    expect(monthYear('2023-11-20T09:00:00+09:00')).toBe('NOV 2023')
  })
})
