'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import type { Database } from '@/types/database'

export type FeedbackState = { error: string } | { ok: true } | null

// Anti-spam : 2 retours max par 24 h et par user (compte DB, pas contournable
// côté client), longueur bornée (le CHECK DB double la garde), auth requise.
const DAILY_FEEDBACK_CAP = 2
const BODY_MIN = 10
const BODY_MAX = 500

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function submitFeedback(
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in to send feedback.' }

  const kind = formData.get('kind') === 'bug' ? 'bug' : 'idea'
  const body = String(formData.get('body') ?? '').trim()
  const page = String(formData.get('page') ?? '').slice(0, 200)
  if (body.length < BODY_MIN) return { error: `Tell us a bit more (min ${BODY_MIN} characters).` }
  if (body.length > BODY_MAX) return { error: `Keep it under ${BODY_MAX} characters.` }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)
  if ((count ?? 0) >= DAILY_FEEDBACK_CAP) {
    return { error: 'Daily feedback limit reached — thanks, come back tomorrow!' }
  }

  const { error } = await supabase
    .from('feedback')
    .insert({ user_id: user.id, kind, body, page: page || null })
  if (error) return { error: 'Could not send feedback. Try again later.' }
  return { ok: true }
}

export interface FeedbackRow {
  id: string
  kind: string
  body: string
  page: string | null
  status: string
  created_at: string
  username: string | null
}

/** Liste admin (service role — la table n'a pas de policy SELECT). */
export async function getFeedbackList(): Promise<FeedbackRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) return []

  const svc = serviceClient()
  const { data } = await svc
    .from('feedback')
    .select('id, kind, body, page, status, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(200)
  if (!data || data.length === 0) return []

  const userIds = [...new Set(data.map((f) => f.user_id))]
  const { data: profiles } = await svc.from('profiles').select('id, username').in('id', userIds)
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.username]))
  return data.map((f) => ({
    id: f.id,
    kind: f.kind,
    body: f.body,
    page: f.page,
    status: f.status,
    created_at: f.created_at,
    username: nameById.get(f.user_id) ?? null,
  }))
}

export async function markFeedbackRead(id: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) return
  await serviceClient().from('feedback').update({ status: 'read' }).eq('id', id)
}
