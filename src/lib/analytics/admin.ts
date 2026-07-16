// Lecture des stats d'activation pour la carte /admin (Phase 2). Pattern
// monitoring/queries.ts : requireAdmin puis service role (product_events,
// event_notifications et digest_log sont deny-all RLS). Volumes bêta → on
// agrège en TS sur des fenêtres bornées plutôt que d'écrire des RPC SQL.

import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import type { ProductEvent } from './events'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return !!user && isAdmin(user.email)
}

// Ordre d'affichage du funnel (audit §10.4) — un sous-ensemble lisible, pas
// les 17 events (le reste est requêtable en SQL).
const FUNNEL_STEPS: readonly { event: ProductEvent; label: string }[] = [
  { event: 'landing_cta_clicked', label: 'CTA landing' },
  { event: 'signup_started', label: 'Signup started' },
  { event: 'signup_completed', label: 'Signup completed' },
  { event: 'onboarding_started', label: 'Onboarding' },
  { event: 'first_group_followed', label: '1st follow' },
  { event: 'three_groups_followed', label: '3 follows' },
  { event: 'personal_calendar_ready', label: 'Calendar ready' },
  { event: 'push_prompt_shown', label: 'Push prompt' },
  { event: 'push_permission_granted', label: 'Push granted' },
  { event: 'calendar_opened', label: 'Calendar opened' },
]

export type ActivationStats = {
  funnel: { event: string; label: string; last7: number; last30: number }[]
  /** Série north-star : users distincts ayant ouvert leur calendrier, par
   * semaine ISO (lundi), 8 dernières semaines, la plus récente en dernier. */
  northStar: { weekStart: string; users: number }[]
  emptySearches: { q: string; seg: string; at: string }[]
  /** Envois de notifs 7 j — lus des tables d'envoi existantes (pas de copie
   * dans product_events : une seule source de vérité). */
  notifSent: { kind: string; count: number }[]
}

/** Lundi (UTC) de la semaine ISO contenant l'instant donné, en 'YYYY-MM-DD'. */
function isoWeekStart(iso: string): string {
  const d = new Date(iso)
  const day = d.getUTCDay() // 0 = dimanche
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff))
  return monday.toISOString().slice(0, 10)
}

export async function getActivationStats(): Promise<ActivationStats | null> {
  if (!(await requireAdmin())) return null
  const svc = serviceClient()
  const now = Date.now()
  const since7 = new Date(now - 7 * 86_400_000).toISOString()
  const since30 = new Date(now - 30 * 86_400_000).toISOString()
  const since56 = new Date(now - 56 * 86_400_000).toISOString()

  const [eventsRes, northRes, searchRes, notifRes, digestRes] = await Promise.all([
    svc.from('product_events').select('event, created_at').gte('created_at', since30).limit(10000),
    svc
      .from('product_events')
      .select('user_id, created_at')
      .eq('event', 'calendar_opened')
      .not('user_id', 'is', null)
      .gte('created_at', since56)
      .limit(10000),
    svc
      .from('product_events')
      .select('props, created_at')
      .eq('event', 'search_no_results')
      .order('created_at', { ascending: false })
      .limit(20),
    svc.from('event_notifications').select('kind, sent_at').gte('sent_at', since7).limit(10000),
    svc.from('digest_log').select('id', { count: 'exact', head: true }).gte('sent_at', since7),
  ])
  if (eventsRes.error) return null

  const counts7 = new Map<string, number>()
  const counts30 = new Map<string, number>()
  for (const row of eventsRes.data ?? []) {
    counts30.set(row.event, (counts30.get(row.event) ?? 0) + 1)
    if (row.created_at >= since7) counts7.set(row.event, (counts7.get(row.event) ?? 0) + 1)
  }
  const funnel = FUNNEL_STEPS.map(({ event, label }) => ({
    event,
    label,
    last7: counts7.get(event) ?? 0,
    last30: counts30.get(event) ?? 0,
  }))

  // North-star : distinct users par semaine ISO (8 semaines glissantes).
  const byWeek = new Map<string, Set<string>>()
  for (const row of northRes.data ?? []) {
    if (!row.user_id) continue
    const week = isoWeekStart(row.created_at)
    const set = byWeek.get(week) ?? new Set<string>()
    set.add(row.user_id)
    byWeek.set(week, set)
  }
  const northStar = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, users]) => ({ weekStart, users: users.size }))

  const emptySearches = (searchRes.data ?? []).map((row) => {
    const props = (row.props ?? {}) as Record<string, unknown>
    return {
      q: typeof props.q === 'string' ? props.q : '',
      seg: typeof props.seg === 'string' ? props.seg : 'all',
      at: row.created_at,
    }
  })

  const notifCounts = new Map<string, number>()
  for (const row of notifRes.data ?? []) {
    notifCounts.set(row.kind, (notifCounts.get(row.kind) ?? 0) + 1)
  }
  const notifSent = [...notifCounts.entries()].map(([kind, count]) => ({ kind, count }))
  if ((digestRes.count ?? 0) > 0) notifSent.push({ kind: 'digest', count: digestRes.count ?? 0 })

  return { funnel, northStar, emptySearches, notifSent }
}
