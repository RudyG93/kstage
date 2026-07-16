// Écriture des events produit — server-only (service role, product_events est
// deny-all RLS). Best-effort de bout en bout : l'analytics ne doit JAMAIS
// casser un parcours (pas de throw, duplicate = dédup réussie, erreur = log).

import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { DEDUPE_POLICY, type ProductEvent } from './events'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** day_key selon la politique de dédup de l'event (null = pas de dédup). */
export function dayKeyFor(event: ProductEvent, now: Date): string | null {
  const policy = DEDUPE_POLICY[event]
  if (policy === 'once') return 'once'
  if (policy === 'daily') return now.toISOString().slice(0, 10)
  return null
}

export async function trackEvent(
  event: ProductEvent,
  opts: {
    userId?: string | null
    anonId?: string | null
    props?: Record<string, string>
    now?: Date
  } = {},
): Promise<void> {
  try {
    const { error } = await serviceClient()
      .from('product_events')
      .insert({
        event,
        user_id: opts.userId ?? null,
        anon_id: opts.anonId ?? null,
        day_key: dayKeyFor(event, opts.now ?? new Date()),
        props: opts.props ?? {},
      })
    // 23505 = l'index unique partiel a fait son travail (dédup daily/once).
    if (error && error.code !== '23505') {
      console.error(`[analytics] insert ${event} failed: ${error.message}`)
    }
  } catch (err) {
    console.error(`[analytics] insert ${event} threw:`, err)
  }
}
