import webpush from 'web-push'
import type { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type ServiceClient = ReturnType<typeof createClient<Database>>

export type PushTarget = { endpoint: string; p256dh: string; auth: string }
// Champs visuels/comportement optionnels (audit notifs 2026-08-20) : le SW
// applique des fallbacks (icône app, pas de buzz) quand ils sont absents.
export type PushPayload = {
  title: string
  body: string
  url: string
  tag?: string
  icon?: string
  image?: string
  actions?: { action: string; title: string }[]
  renotify?: boolean
  timestamp?: number
}

/**
 * Envoie un push web et nettoie l'abonnement mort. Le caller doit avoir appelé
 * `webpush.setVapidDetails(...)` au préalable. Partagé par les crons send-digest
 * et notify-comebacks (DRY).
 *  - 'sent'    : délivré
 *  - 'removed' : endpoint expiré (404/410) → ligne push_subscriptions supprimée
 *  - 'failed'  : autre erreur transitoire (réessayée au prochain run)
 */
export async function sendPush(
  supabase: ServiceClient,
  target: PushTarget,
  payload: PushPayload,
  // TTL 20 h : nos push sont DATÉS (« Today: … », digest du jour) — le défaut
  // de la lib (4 semaines) délivrait un « Today » périmé de plusieurs jours à
  // un téléphone resté éteint. Passé le TTL, le push service jette le message ;
  // le run suivant porte l'info fraîche.
  options: webpush.RequestOptions = { TTL: 72_000, urgency: 'normal' },
): Promise<'sent' | 'removed' | 'failed'> {
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      options,
    )
    return 'sent'
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode
    if (statusCode === 404 || statusCode === 410) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', target.endpoint)
      return 'removed'
    }
    return 'failed'
  }
}
