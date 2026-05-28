'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { isAdmin } from '@/lib/auth/admin'
import { buildEventSlug, generateUniqueSlug } from '@/lib/events/slug'
import { parseSuggestionInput, DAILY_SUGGESTION_CAP } from './validation'

export type SuggestionState = { error: string } | { ok: true } | null
type ActionResult = { error: string } | { ok: true }

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function submitSuggestion(
  _prev: SuggestionState,
  formData: FormData,
): Promise<SuggestionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = parseSuggestionInput({
    groupId: String(formData.get('groupId') ?? ''),
    type: String(formData.get('type') ?? ''),
    title: String(formData.get('title') ?? ''),
    startAtLocal: String(formData.get('startAt') ?? ''),
    sourceUrl: String(formData.get('sourceUrl') ?? ''),
    description: String(formData.get('description') ?? ''),
  })
  if ('error' in parsed) return { error: parsed.error }
  const v = parsed.value

  // Rate-limit : cap quotidien par user (sans infra, simple count DB).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('event_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)
  if ((count ?? 0) >= DAILY_SUGGESTION_CAP) {
    return { error: `Daily limit reached (${DAILY_SUGGESTION_CAP}/day). Try again tomorrow.` }
  }

  const { error } = await supabase.from('event_suggestions').insert({
    user_id: user.id,
    group_id: v.groupId,
    type: v.type,
    title: v.title,
    description: v.description,
    start_at: v.startAt,
    source_url: v.sourceUrl,
  })
  if (error) return { error: 'Could not submit suggestion. Please check the group and try again.' }

  revalidatePath('/my')
  return { ok: true }
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

  const { data: source } = await admin
    .from('sources')
    .select('id')
    .eq('type', 'community')
    .maybeSingle()

  // Slug pour la route article — récupère le slug du groupe puis résout collisions.
  const { data: group } = await admin
    .from('groups')
    .select('slug')
    .eq('id', suggestion.group_id)
    .maybeSingle()
  let slug: string | null = null
  if (group?.slug) {
    const base = buildEventSlug(group.slug, suggestion.title)
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
  revalidatePath('/my')
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
  revalidatePath('/my')
  return { ok: true }
}
