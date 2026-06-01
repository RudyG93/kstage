import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type PublicProfile = Pick<Profile, 'id' | 'username' | 'avatar_url'>

export async function getProfile(userId: string): Promise<PublicProfile | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .eq('id', userId)
    .maybeSingle()
  return data
}

/** Profil public résolu par username (citext) — pour la page /u/[username].
 * Embed bias (membre) + favorite (groupe) résolus pour l'affichage. */
export async function getProfileByUsername(username: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select(
      `id, username, avatar_url, created_at, role, bias_member_id, favorite_group_id,
       bias:members!profiles_bias_member_id_fkey(slug, stage_name, photo_url, groups(name)),
       favorite:groups!profiles_favorite_group_id_fkey(slug, name, image_url)`,
    )
    .eq('username', username)
    .maybeSingle()
  return data
}
