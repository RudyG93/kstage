import { createClient } from '@/lib/supabase/server'

/**
 * Préférences push par type d'event du user courant (RLS scope les rows).
 * Modèle : absence de row = activé par défaut — la map ne contient que les
 * types explicitement touchés. `lead_time_minutes` volontairement non lu
 * (réservé premium futur).
 */
export async function getNotificationPrefs(): Promise<Record<string, boolean>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_notification_settings')
    .select('event_type, enabled')
    .eq('channel', 'push')
  return Object.fromEntries((data ?? []).map((r) => [r.event_type, r.enabled]))
}
