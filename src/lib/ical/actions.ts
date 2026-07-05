'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/** Active le feed iCal (création lazy — la row n'existe qu'à l'opt-in). */
export async function enableCalendarFeed() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Idempotent : la PK user_id fait qu'un double-clic ne crée rien de plus.
  const { error } = await supabase
    .from('calendar_feeds')
    .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
  if (error) throw error
  revalidatePath('/account')
}

/** Régénère le token (URL fuitée) — l'ancienne URL meurt immédiatement. */
export async function regenerateCalendarFeedToken() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('calendar_feeds')
    .update({ token: crypto.randomUUID() })
    .eq('user_id', user.id)
  if (error) throw error
  revalidatePath('/account')
}
