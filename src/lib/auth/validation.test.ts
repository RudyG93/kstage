import { describe, it, expect } from 'vitest'
import { validateCredentials } from './validation'

describe('validateCredentials', () => {
  it('rejette un email sans @', () => {
    expect(validateCredentials('not-an-email', 'password123')).not.toBeNull()
  })

  it('rejette un mot de passe trop court', () => {
    expect(validateCredentials('fan@kstage.app', '123')).not.toBeNull()
  })

  it('accepte des identifiants valides', () => {
    expect(validateCredentials('fan@kstage.app', 'password123')).toBeNull()
  })
})
