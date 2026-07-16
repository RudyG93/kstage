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
import { logScrapeRun } from '@/lib/scrapers/scrape-log'
import { isValidTimeZone } from '@/lib/profiles/timezone'

// Push datés par comeback (§7) : « J-1 / jour J » pour les groupes suivis
// (le kind `announced` a été coupé — budget notifs, Lot 4). Le cron déclenche
// en GET + en-tête Authorization: Bearer ${CRON_SECRET}.
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
    'id, group_id, slug, type, title, start_at, status, source_url, groups!inner(name, slug, confidence), sources(type)'

  // Superset d'events comeback (mv/release) sur la fenêtre [now-1j, now+3j) ;
  // resolveKind fait le test de jour exact PAR FUSEAU. La fenêtre couvre tous
  // les fuseaux (UTC-12 → UTC+14) : « aujourd'hui local » est toujours à
  // < 25 h de now, « demain local » à < 48 h — superset garanti.
  const [subsRes, followsRes, prefsRes, upcomingRes, profilesRes] = await Promise.all([
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
    supabase.from('profiles').select('id, timezone').not('timezone', 'is', null),
  ])

  const err =
    subsRes.error ?? followsRes.error ?? prefsRes.error ?? upcomingRes.error ?? profilesRes.error
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  // Fuseau par abonné (Lot 3b) : profiles.timezone validé ; les abonnés sans
  // réglage restent en KST (défaut du builder). Le cookie tz des anonymes est
  // hors de portée d'un cron — assumé, le réglage existe dans /account.
  const timeZones = new Map<string, string>()
  for (const p of profilesRes.data ?? []) {
    if (isValidTimeZone(p.timezone)) timeZones.set(p.id, p.timezone)
  }

  // Mapping vers ComebackEvent (url + titre nettoyés ici pour garder le
  // builder pur). Défense en profondeur : les events de groupes `candidate`
  // sont écartés dès ici (le builder ré-applique le gate — passesConfidenceGate).
  const events: ComebackEvent[] = (upcomingRes.data ?? [])
    .filter((e) => e.groups?.confidence !== 'candidate')
    .map((e) => ({
      id: e.id,
      groupId: e.group_id,
      groupName: e.groups?.name ?? null,
      title: displayEventTitle(e.title, e.groups?.name, null, e.type),
      type: e.type,
      startAt: e.start_at,
      status: e.status,
      confidence: e.groups?.confidence ?? null,
      sourceType: e.sources?.type ?? null,
      url: eventHref(e),
    }))

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
    timeZones,
  )

  let sent = 0
  let removed = 0
  let failed = 0
  for (const { subscription, payload, record } of messages) {
    const res = await sendPush(supabase, subscription, payload)
    if (res === 'removed') {
      removed += 1
      continue
    }
    if (res !== 'sent') {
      failed += 1
      continue
    }
    sent += 1
    // Marque le trigger comme envoyé (l'unique couvre les races inter-runs).
    await supabase.from('event_notifications').insert({
      user_id: record.userId,
      event_id: record.eventId,
      kind: record.kind,
    })
  }

  // Observabilité (Lot 4/5) : le run alimente scrape_log comme les scrapers —
  // c'est ce que lira le cron monitor. `error` = tout a échoué → 500 → run
  // GitHub Actions rouge → email natif.
  const status =
    messages.length > 0 && sent === 0 && failed > 0 ? 'error' : failed > 0 ? 'partial' : 'ok'
  await logScrapeRun(supabase, {
    source: 'notify_comebacks',
    status,
    startedAt: now.toISOString(),
    errorMsg: failed > 0 ? `${failed} push failed` : undefined,
    details: { candidates: messages.length, sent, removed, failed },
  })

  if (status === 'error') {
    return NextResponse.json(
      { ok: false, candidates: messages.length, sent, removed, failed },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true, candidates: messages.length, sent, removed, failed })
}
