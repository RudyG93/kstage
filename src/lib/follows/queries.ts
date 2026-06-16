import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// RLS limite déjà user_follows aux lignes du user courant → pas besoin de filtrer par user_id.
// `cache()` request-scoped : la sidebar et la page peuvent l'appeler dans le même render.
export const getFollowedGroupIds = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('user_follows').select('group_id')
  if (error) throw error
  return new Set((data ?? []).map((row) => row.group_id))
})
