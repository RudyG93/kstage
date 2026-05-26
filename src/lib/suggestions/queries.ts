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

export type MySuggestion = Awaited<ReturnType<typeof getMySuggestions>>[number]
export type PendingSuggestion = Awaited<ReturnType<typeof getPendingSuggestions>>[number]
