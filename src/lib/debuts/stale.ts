// Auto-écart du bruit des files de revue admin (décision Rudy 2026-08-07 :
// les files gonflaient sans revue — 326 debut candidates, 87 lineup unmatched).
// Un `pending` vieux de STALE_REVIEW_DAYS n'a percé sur aucun canal entre-temps
// alors que les crons re-captent tout groupe qui émerge (discovery hebdo,
// lineups music-show, roster watch) → l'écarter est sans risque de perte.
// Partagé entre l'action admin (bouton) et le cron quotidien scrape-comebacks.

import type { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type SupabaseClient = ReturnType<typeof createClient<Database>>

export const STALE_REVIEW_DAYS = 30

export async function sweepStaleReviewQueues(
  supabase: SupabaseClient,
): Promise<{ dismissed: number; ignored: number; error: string | null }> {
  const cutoff = new Date(Date.now() - STALE_REVIEW_DAYS * 86_400_000).toISOString()
  const [candidates, lineup] = await Promise.all([
    supabase
      .from('debut_candidates')
      .update({ status: 'dismissed', decided_at: new Date().toISOString() })
      .eq('status', 'pending')
      .lt('detected_at', cutoff)
      .select('id'),
    supabase
      .from('lineup_unmatched')
      .update({ status: 'ignored' })
      .eq('status', 'pending')
      .lt('last_seen', cutoff)
      .select('name_norm'),
  ])
  const error = candidates.error ?? lineup.error
  return {
    dismissed: candidates.data?.length ?? 0,
    ignored: lineup.data?.length ?? 0,
    error: error?.message ?? null,
  }
}
