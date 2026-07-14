import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from './admin'

/**
 * Garde admin partagée pour les Server Actions (extraite de banner-actions +
 * debuts/actions, qui la dupliquaient). Redirige vers /login si non connecté,
 * renvoie `{error}` si non-admin, sinon `{ok, email}`.
 */
export async function requireAdmin(): Promise<{ error: string } | { ok: true; email: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdmin(user.email)) return { error: 'Forbidden.' }
  return { ok: true, email: user.email! }
}
