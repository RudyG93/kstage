// Validation des identifiants — logique pure (testée en Vitest), sans appel Supabase.

import { normalizeUsername } from '@/lib/profiles/validation'

export const PASSWORD_MIN = 12

// Nombre de cases de l'OTP (§1.2). DOIT correspondre au réglage Supabase
// « Authentication → Email → Email OTP Length ». Si ce réglage change, ajuster
// ici (les deux doivent rester alignés, sinon la vérification échoue).
export const OTP_LENGTH = 6

/** Login : format email minimal + password non vide. */
export function validateCredentials(email: string, password: string): string | null {
  if (!email.includes('@')) return 'Enter a valid email address.'
  if (!password) return 'Enter your password.'
  return null
}

/** Règles de force du mot de passe (signup, reset, change). */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`
  }
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must contain a digit.'
  return null
}

export interface SignupInput {
  email: string
  username: string
  password: string
  confirm: string
}

/** Valide un formulaire d'inscription complet. Renvoie le username normalisé. */
export function validateSignup(input: SignupInput): { error: string } | { username: string } {
  if (!input.email.includes('@')) return { error: 'Enter a valid email address.' }

  const uname = normalizeUsername(input.username)
  if ('error' in uname) return uname

  const pwError = validatePassword(input.password)
  if (pwError) return { error: pwError }

  if (input.password !== input.confirm) return { error: 'Passwords do not match.' }

  return { username: uname.value }
}
