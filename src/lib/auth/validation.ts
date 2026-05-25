// Validation des identifiants — logique pure (testée en Vitest), sans appel Supabase.

export function validateCredentials(email: string, password: string): string | null {
  if (!email.includes('@')) return 'Enter a valid email address.'
  if (password.length < 6) return 'Password must be at least 6 characters.'
  return null
}
