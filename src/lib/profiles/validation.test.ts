import { describe, it, expect } from 'vitest'
import { normalizeUsername, USERNAME_MIN, USERNAME_MAX } from './validation'

function ok(raw: string): string {
  const r = normalizeUsername(raw)
  if ('error' in r) throw new Error(`expected value, got error: ${r.error}`)
  return r.value
}

describe('normalizeUsername', () => {
  it('accepte un username valide', () => {
    expect(ok('remilio')).toBe('remilio')
  })

  it('préserve la casse saisie (unicité gérée en citext côté DB)', () => {
    expect(ok('ReMilio')).toBe('ReMilio')
  })

  it('trim les espaces autour', () => {
    expect(ok('  remi  ')).toBe('remi')
  })

  it('autorise chiffres et underscores', () => {
    expect(ok('remi_99')).toBe('remi_99')
    expect(ok('_x_')).toBe('_x_')
  })

  it('rejette vide ou uniquement des espaces', () => {
    expect('error' in normalizeUsername('')).toBe(true)
    expect('error' in normalizeUsername('   ')).toBe(true)
  })

  it(`rejette < ${USERNAME_MIN} ou > ${USERNAME_MAX} caractères`, () => {
    expect('error' in normalizeUsername('ab')).toBe(true)
    expect('error' in normalizeUsername('a'.repeat(USERNAME_MAX + 1))).toBe(true)
    // bornes inclusives valides
    expect('value' in normalizeUsername('a'.repeat(USERNAME_MIN))).toBe(true)
    expect('value' in normalizeUsername('a'.repeat(USERNAME_MAX))).toBe(true)
  })

  it('rejette les caractères non alphanumériques (hors underscore)', () => {
    expect('error' in normalizeUsername('remi-lio')).toBe(true)
    expect('error' in normalizeUsername('remi lio')).toBe(true)
    expect('error' in normalizeUsername('remi@app')).toBe(true)
    expect('error' in normalizeUsername('rémi')).toBe(true)
  })
})
