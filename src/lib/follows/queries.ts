import { createClient } from '@/lib/supabase/server'

// RLS limite déjà user_follows aux lignes du user courant → pas besoin de filtrer par user_id.
export async function getFollowedGroupIds(): Promise<Set<string>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('user_follows').select('group_id')
  if (error) throw error
  return new Set((data ?? []).map((row) => row.group_id))
}
