import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import type { Database } from '@/types/database'
import {
  buildDigest,
  type DigestEdition,
  type DigestEvent,
  type DigestFollow,
  type DigestSubscription,
} from '@/lib/notifications/digest'
import { sendPush } from '@/lib/notifications/send'

const DAILY_WINDOW_MS = 48 * 60 * 60 * 1000
const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// Vercel Cron déclenche en GET et ajoute automatiquement l'en-tête
// `Authorization: Bearer ${CRON_SECRET}` quand la var d'env existe.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) {
    return NextResponse.json({ error: 'VAPID env not set' }, { status: 500 })
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Édition hebdo le lundi (« Your k-pop week », fenêtre 7 j) : elle REMPLACE
  // la quotidienne ce jour-là — même cron, contrainte Vercel Hobby 1×/jour.
  // `?edition=weekly` permet le déclenchement manuel hors lundi (test).
  const now = new Date()
  const forced = new URL(req.url).searchParams.get('edition')
  const edition: DigestEdition =
    forced === 'weekly' || (forced === null && now.getUTCDay() === 1) ? 'weekly' : 'daily'
  const until = new Date(
    now.getTime() + (edition === 'weekly' ? WEEKLY_WINDOW_MS : DAILY_WINDOW_MS),
  )

  const [subsRes, followsRes, eventsRes] = await Promise.all([
    supabase.from('push_subscriptions').select('user_id, endpoint, p256dh, auth'),
    supabase.from('user_follows').select('user_id, group_id'),
    supabase
      .from('events')
      .select('group_id, title, start_at, groups!inner(name)')
      .gte('start_at', now.toISOString())
      .lt('start_at', until.toISOString())
      .neq('status', 'cancelled'),
  ])

  const err = subsRes.error ?? followsRes.error ?? eventsRes.error
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  const messages = buildDigest(
    (subsRes.data ?? []).map(
      (s): DigestSubscription => ({
        userId: s.user_id,
        endpoint: s.endpoint,
        p256dh: s.p256dh,
        auth: s.auth,
      }),
    ),
    (followsRes.data ?? []).map((f): DigestFollow => ({ userId: f.user_id, groupId: f.group_id })),
    (eventsRes.data ?? []).map(
      (e): DigestEvent => ({
        groupId: e.group_id,
        title: e.title,
        startAt: e.start_at,
        groupName: e.groups?.name,
      }),
    ),
    edition,
  )

  let sent = 0
  let removed = 0
  for (const { subscription, payload } of messages) {
    const res = await sendPush(supabase, subscription, payload)
    if (res === 'sent') sent += 1
    else if (res === 'removed') removed += 1
  }

  return NextResponse.json({ ok: true, edition, candidates: messages.length, sent, removed })
}
