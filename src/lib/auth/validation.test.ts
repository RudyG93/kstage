import { describe, it, expect } from 'vitest'
import { validateCredentials, validatePassword, validateSignup } from './validation'

describe('validateCredentials', () => {
  it('rejette un email sans @', () => {
    expect(validateCredentials('not-an-email', 'whatever')).not.toBeNull()
  })

  it('rejette un mot de passe vide', () => {
    expect(validateCredentials('fan@kstage.app', '')).not.toBeNull()
  })

  it('accepte des identifiants valides (pas de règle de longueur au login)', () => {
    expect(validateCredentials('fan@kstage.app', 'x')).toBeNull()
  })
})

describe('validatePassword', () => {
  it('rejette < 12 caractères', () => {
    expect(validatePassword('Ab1cdef')).not.toBeNull()
  })

  it('rejette sans majuscule', () => {
    expect(validatePassword('abcdefghij12')).not.toBeNull()
  })

  it('rejette sans chiffre', () => {
    expect(validatePassword('Abcdefghijkl')).not.toBeNull()
  })

  it('accepte ≥12 avec majuscule + chiffre', () => {
    expect(validatePassword('Abcdefghij12')).toBeNull()
  })
})

describe('validateSignup', () => {
  const base = {
    email: 'fan@kstage.app',
    username: 'remilio',
    password: 'Abcdefghij12',
    confirm: 'Abcdefghij12',
  }

  it('accepte un formulaire valide et renvoie le username normalisé', () => {
    expect(validateSignup(base)).toEqual({ username: 'remilio' })
  })

  it('rejette un email invalide', () => {
    expect(validateSignup({ ...base, email: 'nope' })).toEqual({
      error: expect.any(String),
    })
  })

  it('rejette un username invalide', () => {
    expect(validateSignup({ ...base, username: 'a' })).toEqual({
      error: expect.any(String),
    })
  })

  it('rejette un password faible', () => {
    expect(validateSignup({ ...base, password: 'weak', confirm: 'weak' })).toEqual({
      error: expect.any(String),
    })
  })

  it('rejette confirm qui ne matche pas', () => {
    expect(validateSignup({ ...base, confirm: 'Abcdefghij99' })).toEqual({
      error: 'Passwords do not match.',
    })
  })
})
