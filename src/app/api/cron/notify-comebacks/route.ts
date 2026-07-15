import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import type { Database } from '@/types/database'
import {
  buildComebackNotifications,
  type ComebackEvent,
  type ComebackFollow,
  type ComebackSubscription,
} from '@/lib/notifications/comebacks'
import { sendPush } from '@/lib/notifications/send'
import { disabledTypesByUser } from '@/lib/notifications/prefs'
import { eventHref } from '@/lib/events/href'
import { displayEventTitle } from '@/lib/events/title'

// Push datés par comeback (§7) : « annoncé / J-1 / jour J » pour les groupes
// suivis. Vercel Cron déclenche en GET + en-tête Authorization: Bearer ${CRON_SECRET}.
// Idempotent via la table event_notifications (cf. buildComebackNotifications).

const DAY_MS = 24 * 60 * 60 * 1000

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

  const now = new Date()
  const EVENT_FIELDS =
    'id, group_id, slug, type, title, start_at, source_url, created_at, groups!inner(name, slug)'

  // Superset d'events comeback (mv/release) : fenêtre J-1/jour J (avec marge KST)
  // OU créés dans les dernières 24 h (annoncés). Deux requêtes dédupliquées par id
  // — plus lisible qu'un .or() postgREST croisant deux colonnes.
  const [subsRes, followsRes, prefsRes, upcomingRes, announcedRes] = await Promise.all([
    supabase.from('push_subscriptions').select('user_id, endpoint, p256dh, auth'),
    supabase.from('user_follows').select('user_id, group_id'),
    supabase
      .from('user_notification_settings')
      .select('user_id, event_type')
      .eq('enabled', false)
      .eq('channel', 'push'),
    supabase
      .from('events')
      .select(EVENT_FIELDS)
      .in('type', ['mv', 'release'])
      .neq('status', 'cancelled')
      .eq('hidden', false)
      .gte('start_at', new Date(now.getTime() - DAY_MS).toISOString())
      .lt('start_at', new Date(now.getTime() + 3 * DAY_MS).toISOString()),
    supabase
      .from('events')
      .select(EVENT_FIELDS)
      .in('type', ['mv', 'release'])
      .neq('status', 'cancelled')
      .eq('hidden', false)
      .gte('created_at', new Date(now.getTime() - DAY_MS).toISOString())
      .gte('start_at', now.toISOString()),
  ])

  const err =
    subsRes.error ?? followsRes.error ?? prefsRes.error ?? upcomingRes.error ?? announcedRes.error
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  // Dédup par id, puis mapping vers ComebackEvent (url + titre nettoyés ici pour
  // garder le builder pur).
  const byId = new Map<string, ComebackEvent>()
  for (const e of [...(upcomingRes.data ?? []), ...(announcedRes.data ?? [])]) {
    if (byId.has(e.id)) continue
    byId.set(e.id, {
      id: e.id,
      groupId: e.group_id,
      groupName: e.groups?.name ?? null,
      title: displayEventTitle(e.title, e.groups?.name, null, e.type),
      type: e.type,
      startAt: e.start_at,
      createdAt: e.created_at,
      url: eventHref(e),
    })
  }
  const events = [...byId.values()]

  // Triggers déjà envoyés pour ces events (idempotence).
  const eventIds = events.map((e) => e.id)
  const sentRes = eventIds.length
    ? await supabase
        .from('event_notifications')
        .select('user_id, event_id, kind')
        .in('event_id', eventIds)
    : { data: [], error: null }
  if (sentRes.error) return NextResponse.json({ error: sentRes.error.message }, { status: 500 })
  const alreadySent = new Set(
    (sentRes.data ?? []).map((r) => `${r.user_id}:${r.event_id}:${r.kind}`),
  )

  const messages = buildComebackNotifications(
    (subsRes.data ?? []).map(
      (s): ComebackSubscription => ({
        userId: s.user_id,
        endpoint: s.endpoint,
        p256dh: s.p256dh,
        auth: s.auth,
      }),
    ),
    (followsRes.data ?? []).map(
      (f): ComebackFollow => ({ userId: f.user_id, groupId: f.group_id }),
    ),
    events,
    alreadySent,
    now,
    disabledTypesByUser(prefsRes.data ?? []),
  )

  let sent = 0
  let removed = 0
  for (const { subscription, payload, record } of messages) {
    const res = await sendPush(supabase, subscription, payload)
    if (res === 'removed') {
      removed += 1
      continue
    }
    if (res !== 'sent') continue
    sent += 1
    // Marque le trigger comme envoyé (l'unique couvre les races inter-runs).
    await supabase.from('event_notifications').insert({
      user_id: record.userId,
      event_id: record.eventId,
      kind: record.kind,
    })
  }

  return NextResponse.json({ ok: true, candidates: messages.length, sent, removed })
}
