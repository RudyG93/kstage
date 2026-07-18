import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type ViewerProfile = {
  id: string
  username: string | null
  avatar_url: string | null
  timezone: string | null
  bias_member_id: string | null
}

/** Identité minimale du viewer, extraite des claims JWT (sub + email). */
export type ViewerUser = { id: string; email: string | null }

/**
 * Viewer résolu UNE fois par requête (mémoïsé) : vérification LOCALE du JWT
 * via getClaims (clés de signature asymétriques ECC — Lot 1bis 2026-07-18,
 * zéro aller-retour Auth) + 1 select profiles, au lieu des ~4 getUser() réseau
 * que layout / timezone / sidebars faisaient chacun de leur côté. Tous les
 * LECTEURS du viewer passent par ici ; les écritures sensibles (server
 * actions, gates admin) gardent leur propre supabase.auth.getUser().
 */
export const getViewer = cache(
  async (): Promise<{ user: ViewerUser | null; profile: ViewerProfile | null }> => {
    const supabase = await createClient()
    const { data } = await supabase.auth.getClaims()
    const claims = data?.claims
    if (!claims?.sub) return { user: null, profile: null }
    const user: ViewerUser = {
      id: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : null,
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, timezone, bias_member_id')
      .eq('id', user.id)
      .maybeSingle()
    return { user, profile }
  },
)
