'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function toggleFollow(groupId: string, isFollowing: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (isFollowing) {
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('user_id', user.id)
      .eq('group_id', groupId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('user_follows')
      .insert({ user_id: user.id, group_id: groupId })
    if (error) throw error
  }

  revalidatePath('/')
  revalidatePath('/groups')
}
