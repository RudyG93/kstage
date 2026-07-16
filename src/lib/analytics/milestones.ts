// Jalons de follow (audit §10.3 : « premier groupe suivi », « trois groupes
// suivis »). La partie pure est testée ; le helper serveur compte puis track —
// la dédup 'once' de product_events absorbe les répétitions et les races.

import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { trackEvent } from './track'
import type { ProductEvent } from './events'

/** Jalons atteints pour un total de follows APRÈS l'action. */
export function followMilestones(totalAfter: number): ProductEvent[] {
  const out: ProductEvent[] = []
  if (totalAfter >= 1) out.push('first_group_followed')
  if (totalAfter >= 3) out.push('three_groups_followed')
  return out
}

/** Compte les follows du user et émet les jalons (best-effort, no-throw). */
export async function trackFollowMilestones(userId: string): Promise<void> {
  try {
    const supabase = createServiceClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { count, error } = await supabase
      .from('user_follows')
      .select('group_id', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (error || count === null) return
    for (const event of followMilestones(count)) {
      await trackEvent(event, { userId })
    }
  } catch (err) {
    console.error('[analytics] follow milestones threw:', err)
  }
}
