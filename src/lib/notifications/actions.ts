'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { trackEvent } from '@/lib/analytics/track'

export type PushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}

// Cap anti-abus sur l'enregistrement d'endpoints push : 20/24 h laisse une
// large marge à un user légitime (2-3 devices + ré-abonnements SW) mais borne
// le spam d'endpoints dans une table qui alimente web-push.
const PUSH_SUBSCRIBE_DAILY_CAP = 20

export async function savePushSubscription(sub: PushSubscriptionInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: allowed, error: rateErr } = await supabase.rpc('consume_rate_limit', {
    p_action: 'push_subscribe',
    p_max: PUSH_SUBSCRIBE_DAILY_CAP,
    p_window_seconds: 24 * 60 * 60,
  })
  if (rateErr) throw rateErr
  if (!allowed) throw new Error('Too many notification updates today. Try again tomorrow.')

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

// Types acceptés par l'action. L'UI expose les quatre catégories du lancement ;
// live reste accepté pour les anciennes préférences et la compatibilité interne.
const PREF_TYPES = ['mv', 'release', 'music_show', 'anniversary', 'live'] as const
export type NotificationPrefType = (typeof PREF_TYPES)[number]

/** Upsert la préférence push d'un type d'event (absence de row = activé). */
export async function setNotificationPref(eventType: string, enabled: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!PREF_TYPES.includes(eventType as NotificationPrefType)) {
    throw new Error('Invalid notification type')
  }

  const { error } = await supabase.from('user_notification_settings').upsert(
    {
      user_id: user.id,
      event_type: eventType as NotificationPrefType,
      channel: 'push',
      enabled,
    },
    { onConflict: 'user_id,event_type,channel' },
  )
  if (error) throw error

  // Signal de sur-notification (audit §10.3) : seule la DÉSACTIVATION compte.
  if (!enabled) {
    await trackEvent('notification_type_disabled', {
      userId: user.id,
      props: { type: eventType },
    })
  }
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
