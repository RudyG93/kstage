'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type PushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}

export async function savePushSubscription(sub: PushSubscriptionInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.userAgent ?? null,
    },
    { onConflict: 'user_id,endpoint' },
  )
  if (error) throw error
}

export async function deletePushSubscription(endpoint: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)
  if (error) throw error
}
