'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { isAdmin } from '@/lib/auth/admin'

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

export interface OpenReport {
  id: string
  reason: string | null
  created_at: string
  commentId: string
  body: string
  deleted: boolean
  authorUsername: string | null
  eventSlug: string | null
  eventTitle: string | null
}

/** Signalements ouverts pour la page admin (service role). */
export async function getOpenReports(): Promise<OpenReport[]> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from('comment_report')
    .select(
      'id, reason, created_at, comment:comments(id, body, user_id, deleted_at, event:events(slug, title))',
    )
    .eq('status', 'open')
    .order('created_at', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as unknown as Array<{
    id: string
    reason: string | null
    created_at: string
    comment: {
      id: string
      body: string
      user_id: string
      deleted_at: string | null
      event: { slug: string | null; title: string } | null
    } | null
  }>

  const authorIds = [...new Set(rows.map((r) => r.comment?.user_id).filter(Boolean) as string[])]
  const usernameById = new Map<string, string | null>()
  if (authorIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, username')
      .in('id', authorIds)
    for (const p of profiles ?? []) usernameById.set(p.id, p.username)
  }

  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    created_at: r.created_at,
    commentId: r.comment?.id ?? '',
    body: r.comment?.body ?? '[deleted]',
    deleted: Boolean(r.comment?.deleted_at),
    authorUsername: r.comment ? (usernameById.get(r.comment.user_id) ?? null) : null,
    eventSlug: r.comment?.event?.slug ?? null,
    eventTitle: r.comment?.event?.title ?? null,
  }))
}

/** Résout un signalement : soft-delete le commentaire + clôt les reports ouverts. */
export async function resolveReport(reportId: string): Promise<ActionResult> {
  const user = await requireAdminUser()
  const admin = serviceClient()

  const { data: report } = await admin
    .from('comment_report')
    .select('comment_id')
    .eq('id', reportId)
    .maybeSingle()
  if (!report) return { error: 'Report not found.' }

  await admin
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', report.comment_id)

  const { error } = await admin
    .from('comment_report')
    .update({ status: 'resolved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('comment_id', report.comment_id)
    .eq('status', 'open')
  if (error) return { error: 'Could not resolve the report.' }

  revalidatePath('/admin/reports')
  return { ok: true }
}

/** Rejette un signalement (commentaire jugé légitime). */
export async function dismissReport(reportId: string): Promise<ActionResult> {
  const user = await requireAdminUser()
  const admin = serviceClient()

  const { error } = await admin
    .from('comment_report')
    .update({ status: 'dismissed', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', reportId)
    .eq('status', 'open')
  if (error) return { error: 'Could not dismiss the report.' }

  revalidatePath('/admin/reports')
  return { ok: true }
}
