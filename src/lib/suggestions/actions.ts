'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { isAdmin } from '@/lib/auth/admin'
import { buildEventSlug, generateUniqueSlug, slugify } from '@/lib/events/slug'

type ActionResult = { error: string } | { ok: true }

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function requireAdminUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdmin(user.email)) redirect('/')
  return user
}

export async function approveSuggestion(id: string): Promise<ActionResult> {
  const user = await requireAdminUser()
  const admin = serviceClient()

  const { data: suggestion, error: readErr } = await admin
    .from('event_suggestions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (readErr || !suggestion) return { error: 'Suggestion not found.' }
  if (suggestion.status !== 'pending') return { error: 'This suggestion was already reviewed.' }
  // Un "fix" ne crée pas d'event : l'admin le traite via markSuggestionHandled.
  if (suggestion.kind === 'fix') return { error: 'Use "Mark handled" for fix reports.' }

  const { data: source } = await admin
    .from('sources')
    .select('id')
    .eq('type', 'community')
    .maybeSingle()

  // Slug pour la route article — récupère slug + name du groupe (name pour la
  // déduplication du préfixe quand le titre commence par le nom du groupe).
  const { data: group } = await admin
    .from('groups')
    .select('slug, name')
    .eq('id', suggestion.group_id)
    .maybeSingle()
  let slug: string | null = null
  if (group?.slug) {
    const base = buildEventSlug(group.slug, suggestion.title, group.name)
    slug = await generateUniqueSlug(base, async (candidate) => {
      const { data } = await admin.from('events').select('id').eq('slug', candidate).maybeSingle()
      return Boolean(data)
    })
  }

  const { error: insertErr } = await admin.from('events').insert({
    group_id: suggestion.group_id,
    type: suggestion.type,
    title: suggestion.title,
    description: suggestion.description,
    start_at: suggestion.start_at,
    status: 'confirmed',
    source_id: source?.id ?? null,
    source_url: suggestion.source_url,
    slug,
  })
  // Collision sur la contrainte unique events = event déjà présent → on continue.
  if (insertErr && !/duplicate key|unique/i.test(insertErr.message)) {
    return { error: 'Could not create the event.' }
  }

  const { error: updateErr } = await admin
    .from('event_suggestions')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
  if (updateErr) return { error: 'Event created but the suggestion status could not be updated.' }

  revalidatePath('/admin/suggestions')
  revalidatePath('/')
  return { ok: true }
}

export async function rejectSuggestion(id: string): Promise<ActionResult> {
  const user = await requireAdminUser()
  const admin = serviceClient()

  const { error } = await admin
    .from('event_suggestions')
    .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
  if (error) return { error: 'Could not reject the suggestion.' }

  revalidatePath('/admin/suggestions')
  revalidatePath('/')
  return { ok: true }
}

/** Marque un fix comme traité (lecture seule : pas d'insertion d'event). */
export async function markSuggestionHandled(id: string): Promise<ActionResult> {
  const user = await requireAdminUser()
  const admin = serviceClient()
  const { error } = await admin
    .from('event_suggestions')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
  if (error) return { error: 'Could not update the fix.' }
  revalidatePath('/admin/suggestions')
  return { ok: true }
}

/** Approuve une suggestion d'artiste : crée le groupe (+membres) puis clôt. */
export async function approveArtistSuggestion(id: string): Promise<ActionResult> {
  const user = await requireAdminUser()
  const admin = serviceClient()

  const { data: s, error: readErr } = await admin
    .from('artist_suggestions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (readErr || !s) return { error: 'Suggestion not found.' }
  if (s.status !== 'pending') return { error: 'This suggestion was already reviewed.' }

  const base = slugify(s.name)
  if (!base) return { error: 'Could not derive a slug from the name.' }
  const slug = await generateUniqueSlug(base, async (candidate) => {
    const { data } = await admin.from('groups').select('id').eq('slug', candidate).maybeSingle()
    return Boolean(data)
  })

  const { data: group, error: groupErr } = await admin
    .from('groups')
    .insert({
      name: s.name,
      slug,
      is_solo: s.kind === 'solo',
      agency: s.agency,
      debut_date: s.debut_date,
      fandom_name: s.fandom_name,
      color_hex: s.color_hex,
      image_url: s.image_url,
    })
    .select('id')
    .single()
  if (groupErr || !group) return { error: 'Could not create the group.' }

  const members = (Array.isArray(s.members) ? s.members : []) as Array<{
    name?: string
    position?: string | null
  }>
  const rows = members
    .filter((m) => m && typeof m.name === 'string' && m.name.trim())
    .map((m) => ({
      group_id: group.id,
      stage_name: String(m.name).trim(),
      position: m.position ? String(m.position) : null,
      status: 'active' as const,
    }))
  if (rows.length > 0) {
    const { error: membersErr } = await admin.from('members').insert(rows)
    if (membersErr) {
      // Le groupe existe déjà ; on signale mais on ne rollback pas.
      return { error: 'Group created, but some members could not be added.' }
    }
  }

  const { error: updErr } = await admin
    .from('artist_suggestions')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
  if (updErr) return { error: 'Group created but the suggestion status could not be updated.' }

  revalidatePath('/admin/suggestions')
  revalidatePath('/groups')
  return { ok: true }
}

/** Rejette une suggestion d'artiste. */
export async function rejectArtistSuggestion(id: string): Promise<ActionResult> {
  const user = await requireAdminUser()
  const admin = serviceClient()
  const { error } = await admin
    .from('artist_suggestions')
    .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
  if (error) return { error: 'Could not reject the suggestion.' }
  revalidatePath('/admin/suggestions')
  return { ok: true }
}
