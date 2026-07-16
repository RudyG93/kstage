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
import { disabledTypesByUser } from '@/lib/notifications/prefs'
import { logScrapeRun } from '@/lib/scrapers/scrape-log'

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

  // Idempotence (Lot 4) : une ligne digest_log par (user, jour UTC, édition)
  // servi — un re-run du cron ne renvoie pas le digest aux users déjà servis.
  const dayKey = now.toISOString().slice(0, 10)

  const [subsRes, followsRes, prefsRes, eventsRes, sentRes] = await Promise.all([
    supabase.from('push_subscriptions').select('user_id, endpoint, p256dh, auth'),
    supabase.from('user_follows').select('user_id, group_id'),
    supabase
      .from('user_notification_settings')
      .select('user_id, event_type')
      .eq('enabled', false)
      .eq('channel', 'push'),
    supabase
      .from('events')
      .select(
        'group_id, title, start_at, type, status, groups!inner(name, confidence), sources(type)',
      )
      .gte('start_at', now.toISOString())
      .lt('start_at', until.toISOString())
      .neq('status', 'cancelled')
      .eq('hidden', false),
    supabase.from('digest_log').select('user_id').eq('day_key', dayKey).eq('edition', edition),
  ])

  const err =
    subsRes.error ?? followsRes.error ?? prefsRes.error ?? eventsRes.error ?? sentRes.error
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  const alreadyServed = new Set((sentRes.data ?? []).map((r) => r.user_id))

  const built = buildDigest(
    (subsRes.data ?? []).map(
      (s): DigestSubscription => ({
        userId: s.user_id,
        endpoint: s.endpoint,
        p256dh: s.p256dh,
        auth: s.auth,
      }),
    ),
    (followsRes.data ?? []).map((f): DigestFollow => ({ userId: f.user_id, groupId: f.group_id })),
    // Défense en profondeur : candidate écarté dès la route (le builder
    // ré-applique le gate — passesConfidenceGate).
    (eventsRes.data ?? [])
      .filter((e) => e.groups?.confidence !== 'candidate')
      .map(
        (e): DigestEvent => ({
          groupId: e.group_id,
          title: e.title,
          startAt: e.start_at,
          groupName: e.groups?.name,
          type: e.type,
          status: e.status,
          confidence: e.groups?.confidence ?? null,
          sourceType: e.sources?.type ?? null,
        }),
      ),
    edition,
    disabledTypesByUser(prefsRes.data ?? []),
  )
  // Filtrage idempotence dans la route (le builder reste pur).
  const messages = built.filter((m) => !alreadyServed.has(m.subscription.userId))
  const skipped = built.length - messages.length

  let sent = 0
  let removed = 0
  let failed = 0
  const servedUsers = new Set<string>()
  for (const { subscription, payload } of messages) {
    const res = await sendPush(supabase, subscription, payload)
    if (res === 'sent') {
      sent += 1
      servedUsers.add(subscription.userId)
    } else if (res === 'removed') removed += 1
    else failed += 1
  }

  // Une ligne par user servi (multi-device = 1 seule ligne) ; ignoreDuplicates
  // couvre la course inter-runs sur l'unique (user_id, day_key, edition).
  if (servedUsers.size > 0) {
    await supabase.from('digest_log').upsert(
      [...servedUsers].map((userId) => ({ user_id: userId, day_key: dayKey, edition })),
      { onConflict: 'user_id,day_key,edition', ignoreDuplicates: true },
    )
  }

  // Observabilité (Lot 4/5) : alimente scrape_log pour le cron monitor.
  const status =
    messages.length > 0 && sent === 0 && failed > 0 ? 'error' : failed > 0 ? 'partial' : 'ok'
  await logScrapeRun(supabase, {
    source: 'send_digest',
    status,
    startedAt: now.toISOString(),
    errorMsg: failed > 0 ? `${failed} push failed` : undefined,
    details: { edition, candidates: messages.length, sent, removed, failed, skipped },
  })

  if (status === 'error') {
    return NextResponse.json(
      { ok: false, edition, candidates: messages.length, sent, removed, failed, skipped },
      { status: 500 },
    )
  }
  return NextResponse.json({
    ok: true,
    edition,
    candidates: messages.length,
    sent,
    removed,
    failed,
    skipped,
  })
}
