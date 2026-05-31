'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Like / unlike binaire d'un MV (table mv_like). */
export async function toggleLike(eventId: string, isLiked: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (isLiked) {
    const { error } = await supabase
      .from('mv_like')
      .delete()
      .eq('user_id', user.id)
      .eq('event_id', eventId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('mv_like').insert({ user_id: user.id, event_id: eventId })
    if (error) throw error
  }
}
