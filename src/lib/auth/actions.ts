'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { validateCredentials, validateSignup } from './validation'

export type AuthState = { error: string } | null

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const invalid = validateCredentials(email, password)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Invalid email or password.' }

  redirect('/')
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const valid = validateSignup({
    email,
    username: String(formData.get('username') ?? ''),
    password: String(formData.get('password') ?? ''),
    confirm: String(formData.get('confirm') ?? ''),
  })
  if ('error' in valid) return { error: valid.error }
  const { username } = valid
  const password = String(formData.get('password') ?? '')

  const supabase = await createClient()

  // Pré-check de disponibilité du username (citext = insensible à la casse).
  // La contrainte unique reste le garde-fou anti-race ; ce check ne sert qu'au
  // message d'erreur clair avant de créer le compte.
  const { data: taken } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (taken) return { error: 'That username is already taken.' }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  })
  // Message générique : pas de fuite « email déjà utilisé » (anti-énumération).
  if (error) return { error: 'Could not create the account. Try a different email or username.' }

  // Confirm email OFF → session déjà ouverte. ON → vérification par code OTP.
  if (data.session) redirect('/')
  redirect(`/signup/verify?email=${encodeURIComponent(email)}`)
}

export async function verifySignupOtp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  // Supabase stocke l'email en minuscules ; on aligne pour éviter tout mismatch.
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const token = String(formData.get('token') ?? '').trim()
  // Longueur de l'OTP = réglage Supabase (6 à 10) ; on reste agnostique pour ne
  // pas casser si "Email OTP Length" change (ici 8 en prod).
  if (!/^\d{6,10}$/.test(token)) return { error: 'Enter the code from the email.' }

  const supabase = await createClient()
  // Saisie d'un code ({{ .Token }}) → type 'email' (le 'signup' est réservé au
  // flux par lien token_hash). Cf. doc Supabase Email Templates.
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) return { error: 'Invalid or expired code.' }

  redirect('/')
}

export async function resendSignupOtp(email: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.resend({ type: 'signup', email })
  if (error) return { error: 'Could not resend the code.' }
  return { ok: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
