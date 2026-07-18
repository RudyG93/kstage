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

/**
 * Garde admin des PAGES /admin/* (Lot D 2026-07-18) : redirige au lieu de
 * renvoyer `{error}` — /login si déconnecté, / si non-admin. Utilisée par le
 * layout central `src/app/admin/layout.tsx` ET par chaque page (défense en
 * profondeur : un layout n'est pas une frontière d'auth à lui seul).
 */
export async function requireAdminPage(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdmin(user.email)) redirect('/')
}
