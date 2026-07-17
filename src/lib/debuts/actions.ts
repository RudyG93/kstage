'use server'

// Actions admin de la file de revue des debuts (R4-I) : Create force la
// création d'un candidat que le gate automatique n'a pas retenu ; Dismiss
// l'écarte. Service role après contrôle isAdmin (la table est deny-all RLS).

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { createFromPayload, type DebutCandidatePayload } from '@/lib/scrapers/debuts/ingest'

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

/**
 * Les rows auto-écartées par le gate (already-in-db, no-infobox) portent un
 * payload MINIMAL `{reason}` (cf. ingest.ts), pas un DebutCandidatePayload
 * complet — l'ancien cast le masquait et la page crashait sur
 * `payload.members` (bug 2026-07-17, row BOYNEXTDOOR).
 */
export type DismissedReasonPayload = { reason: string }

export interface DebutCandidateRow {
  id: string
  page_title: string
  status: string
  detected_at: string
  payload: DebutCandidatePayload | DismissedReasonPayload | null
  /** Tier de confiance du groupe créé (Phase 3 Lot 2) — null si pas créé. */
  group_confidence: string | null
}

export async function getDebutCandidates(): Promise<DebutCandidateRow[]> {
  if (!(await requireAdmin())) return []
  const { data } = await serviceClient()
    .from('debut_candidates')
    .select('id, page_title, status, detected_at, payload, groups(confidence)')
    .order('detected_at', { ascending: false })
    .limit(100)
  return (data ?? []).map(({ groups, ...row }) => ({
    ...row,
    payload: row.payload as unknown as DebutCandidatePayload | DismissedReasonPayload | null,
    group_confidence: groups?.confidence ?? null,
  }))
}

export async function approveDebutCandidate(id: string): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: 'Unauthorized' }
  const supabase = serviceClient()
  const { data: row } = await supabase
    .from('debut_candidates')
    .select('id, status, payload')
    .eq('id', id)
    .maybeSingle()
  if (!row || row.status !== 'pending') return { error: 'Candidat introuvable ou déjà décidé' }
  const payload = row.payload as unknown as DebutCandidatePayload | null
  if (!payload?.name) return { error: 'Payload incomplet — création manuelle requise' }

  const res = await createFromPayload(supabase, payload)
  if ('error' in res) return { error: res.error }

  await supabase
    .from('debut_candidates')
    .update({ status: 'created', group_id: res.groupId, decided_at: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/admin/debuts')
  return {}
}

export async function dismissDebutCandidate(id: string): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: 'Unauthorized' }
  await serviceClient()
    .from('debut_candidates')
    .update({ status: 'dismissed', decided_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
  revalidatePath('/admin/debuts')
  return {}
}
