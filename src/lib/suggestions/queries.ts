import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

/** Suggestions de l'utilisateur courant (RLS own-rows). */
export async function getMySuggestions() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('event_suggestions')
    .select('id, type, title, start_at, status, created_at, groups!inner(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Toutes les suggestions en attente (service_role) — appelé uniquement depuis la page admin gardée. */
export async function getPendingSuggestions() {
  const admin = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data, error } = await admin
    .from('event_suggestions')
    .select('id, type, title, start_at, source_url, description, created_at, groups!inner(name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Nombre de suggestions en attente (service_role) — pour le badge admin. */
export async function getPendingSuggestionsCount(): Promise<number> {
  const admin = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { count, error } = await admin
    .from('event_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) throw error
  return count ?? 0
}

/**
 * Events ciblables par un Suggest-fix : upcoming + récents (dernières 30j),
 * limit 200, triés par date desc. Lecture publique (RLS events = read-all),
 * pas besoin du service role.
 */
export async function getTargetableEvents() {
  const supabase = await createClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('events')
    .select('id, title, type, start_at, groups!inner(name)')
    .gte('start_at', since)
    .order('start_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return data ?? []
}

export type MySuggestion = Awaited<ReturnType<typeof getMySuggestions>>[number]
export type PendingSuggestion = Awaited<ReturnType<typeof getPendingSuggestions>>[number]
export type TargetableEvent = Awaited<ReturnType<typeof getTargetableEvents>>[number]
