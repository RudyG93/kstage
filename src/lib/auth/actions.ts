'use server'

import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { validateSignup, validatePassword } from './validation'
import type { Database } from '@/types/database'

export type AuthState = { error: string } | null

// Longueur de l'OTP = réglage Supabase (6 à 10) ; on reste agnostique pour ne
// pas casser si "Email OTP Length" change (8 en prod).
const OTP_RE = /^\d{6,10}$/

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!identifier || !password) {
    return { error: 'Enter your email/username and password.' }
  }

  // Email = contient '@'. Sinon username → on résout l'email via service-role
  // (profiles.username citext, puis getUserById). Lookup server-only : pas de
  // fuite username→email côté client.
  let email = identifier
  if (!identifier.includes('@')) {
    const admin = serviceClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('username', identifier)
      .maybeSingle()
    if (!profile) return { error: 'Invalid email/username or password.' }
    const { data: userRes, error: adminErr } = await admin.auth.admin.getUserById(profile.id)
    if (adminErr || !userRes.user?.email) return { error: 'Invalid email/username or password.' }
    email = userRes.user.email
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Invalid email/username or password.' }

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
  if (!OTP_RE.test(token)) return { error: 'Enter the code from the email.' }

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

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  if (!email.includes('@')) return { error: 'Enter a valid email address.' }

  const supabase = await createClient()
  // Résultat ignoré : on redirige toujours vers la page de saisie du code,
  // qu'un compte existe ou non (anti-énumération).
  await supabase.auth.resetPasswordForEmail(email)
  redirect(`/reset-password/verify?email=${encodeURIComponent(email)}`)
}

export async function resetPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const token = String(formData.get('token') ?? '').trim()
  if (!OTP_RE.test(token)) return { error: 'Enter the code from the email.' }

  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  const pwError = validatePassword(password)
  if (pwError) return { error: pwError }
  if (password !== confirm) return { error: 'Passwords do not match.' }

  const supabase = await createClient()
  // verifyOtp 'recovery' ouvre une session de récupération, puis updateUser
  // applique le nouveau mot de passe.
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' })
  if (error) return { error: 'Invalid or expired code.' }
  const { error: upErr } = await supabase.auth.updateUser({ password })
  if (upErr) return { error: 'Could not update the password.' }

  redirect('/')
}

export async function resendRecoveryOtp(email: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) return { error: 'Could not resend the code.' }
  return { ok: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
