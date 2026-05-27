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
