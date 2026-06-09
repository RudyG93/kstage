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

/** Suit plusieurs groupes d'un coup (onboarding). Idempotent (ignore les doublons). */
export async function followMany(groupIds: string[]) {
  if (groupIds.length === 0) return
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rows = groupIds.map((group_id) => ({ user_id: user.id, group_id }))
  const { error } = await supabase
    .from('user_follows')
    .upsert(rows, { onConflict: 'user_id,group_id', ignoreDuplicates: true })
  if (error) throw error

  revalidatePath('/')
  revalidatePath('/groups')
}
