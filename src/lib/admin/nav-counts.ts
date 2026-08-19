// Compteurs des files de revue pour la nav admin persistante (2026-08-19,
// demande Rudy : « où dois-je agir ? » visible d'un coup d'œil depuis toute
// page /admin/*). Head-only counts en parallèle, service role — appelé par le
// layout admin UNIQUEMENT (déjà derrière requireAdminPage).

import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type AdminNavCounts = {
  debuts: number
  suggestions: number
  feedback: number
  reports: number
}

export async function getAdminNavCounts(): Promise<AdminNavCounts> {
  const admin = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const head = { count: 'exact' as const, head: true }
  const [debuts, lineup, sugg, artistSugg, feedback, reports] = await Promise.all([
    admin.from('debut_candidates').select('id', head).eq('status', 'pending'),
    admin.from('lineup_unmatched').select('name_norm', head).eq('status', 'pending'),
    admin.from('event_suggestions').select('id', head).eq('status', 'pending'),
    admin.from('artist_suggestions').select('id', head).eq('status', 'pending'),
    admin.from('feedback').select('id', head).eq('status', 'new'),
    admin.from('comment_report').select('id', head).eq('status', 'open'),
  ])
  return {
    debuts: (debuts.count ?? 0) + (lineup.count ?? 0),
    suggestions: (sugg.count ?? 0) + (artistSugg.count ?? 0),
    feedback: feedback.count ?? 0,
    reports: reports.count ?? 0,
  }
}
