'use server'

// Actions admin de la file de revue des debuts (R4-I) : Create force la
// création d'un candidat que le gate automatique n'a pas retenu ; Dismiss
// l'écarte. Service role après contrôle isAdmin (la table est deny-all RLS).

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import {
  createFromPayload,
  ingestNamedGroups,
  type DebutCandidatePayload,
} from '@/lib/scrapers/debuts/ingest'

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

// ——— File « artistes de lineup hors-app » (retour Rudy 2026-07-17) ————————
// Alimentée par le cron scrape-music-shows (table lineup_unmatched, deny-all
// RLS) ; l'admin crée via le pipeline fandom complet ou ignore le bruit.

export interface LineupUnmatchedRow {
  name_norm: string
  display_name: string
  shows: string[]
  occurrences: number
  last_seen: string
}

export async function getLineupUnmatched(): Promise<LineupUnmatchedRow[]> {
  if (!(await requireAdmin())) return []
  const { data } = await serviceClient()
    .from('lineup_unmatched')
    .select('name_norm, display_name, shows, occurrences, last_seen')
    .eq('status', 'pending')
    .order('occurrences', { ascending: false })
    .order('last_seen', { ascending: false })
    .limit(50)
  return data ?? []
}

export async function createLineupArtist(nameNorm: string): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: 'Unauthorized' }
  const supabase = serviceClient()
  const { data: row } = await supabase
    .from('lineup_unmatched')
    .select('name_norm, display_name, status')
    .eq('name_norm', nameNorm)
    .maybeSingle()
  if (!row || row.status !== 'pending') return { error: 'Entrée introuvable ou déjà décidée' }

  const { created, skipped } = await ingestNamedGroups(supabase, [row.display_name], {
    youtubeKey: process.env.YOUTUBE_API_KEY,
  })
  if (created.length === 0) {
    const reason = skipped[0]?.reason ?? 'unknown'
    if (reason === 'already-in-db') {
      // Variante de nom d'un groupe existant : rien à créer, on sort de la file.
      await supabase
        .from('lineup_unmatched')
        .update({ status: 'ignored' })
        .eq('name_norm', nameNorm)
      revalidatePath('/admin/debuts')
      return { error: 'Déjà en base (variante de nom probable) — entrée ignorée' }
    }
    // Échec fandom (no-infobox-match, search-failed…) : l'entrée RESTE pending
    // pour une création manuelle de repli.
    return { error: `Création impossible (${reason}) — à créer manuellement` }
  }
  await supabase.from('lineup_unmatched').update({ status: 'created' }).eq('name_norm', nameNorm)
  revalidatePath('/admin/debuts')
  return {}
}

export async function ignoreLineupUnmatched(nameNorm: string): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: 'Unauthorized' }
  await serviceClient()
    .from('lineup_unmatched')
    .update({ status: 'ignored' })
    .eq('name_norm', nameNorm)
    .eq('status', 'pending')
  revalidatePath('/admin/debuts')
  return {}
}
