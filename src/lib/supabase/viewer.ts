import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type ViewerProfile = {
  id: string
  username: string | null
  avatar_url: string | null
  timezone: string | null
  bias_member_id: string | null
}

/**
 * Viewer résolu UNE fois par requête (mémoïsé) : 1 aller-retour auth + 1 select
 * profiles, au lieu des ~4 getUser() réseau que layout / timezone / sidebars
 * faisaient chacun de leur côté. Tous les lecteurs du viewer passent par ici ;
 * les écritures sensibles gardent leur propre supabase.auth.getUser().
 */
export const getViewer = cache(
  async (): Promise<{ user: User | null; profile: ViewerProfile | null }> => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { user: null, profile: null }
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, timezone, bias_member_id')
      .eq('id', user.id)
      .maybeSingle()
    return { user, profile }
  },
)
