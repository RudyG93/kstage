// Construction des push datés par comeback (§7) — logique pure et testable
// (aucun I/O). Le cron fournit abonnements + follows + comebacks (events mv/release)
// + l'ensemble des triggers déjà envoyés ; on produit un message par (abonnement,
// event, kind) pertinent et non encore envoyé.
//
// Un comeback déclenche jusqu'à 3 push au fil du temps, façon Bandsintown :
//   announced (vient d'être ajouté en DB) → day_before (J-1) → day_of (jour J).
// Fenêtres calées sur le JOUR KST (référence k-pop, cohérent avec le reste de
// l'app). Précédence pour qu'un même run n'émette qu'UN kind par event :
//   day_of > day_before > announced.

import { kstDayKey } from '@/lib/events/date'

export type ComebackSubscription = {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
}

export type ComebackFollow = { userId: string; groupId: string }

export type ComebackEvent = {
  id: string
  groupId: string
  groupName: string | null
  title: string // déjà nettoyé (displayEventTitle) côté route
  type: string // mv | release — sert au filtre préférences par user
  startAt: string
  createdAt: string
  url: string // déjà résolu (eventHref) côté route
}

export type NotificationKind = 'announced' | 'day_before' | 'day_of'

export type ComebackPayload = { title: string; body: string; url: string }
export type ComebackRecord = { userId: string; eventId: string; kind: NotificationKind }
export type ComebackMessage = {
  subscription: ComebackSubscription
  payload: ComebackPayload
  record: ComebackRecord
}

const ANNOUNCED_WINDOW_MS = 24 * 60 * 60 * 1000

const addDaysKey = (key: string, days: number): string => {
  const [y, m, d] = key.split('-').map(Number)
  return kstDayKey(new Date(Date.UTC(y, m - 1, d + days)).toISOString())
}

/**
 * Le `kind` applicable à un event au moment `now`, ou null si aucun.
 * Précédence day_of > day_before > announced → un seul kind par run.
 */
function resolveKind(event: ComebackEvent, now: Date): NotificationKind | null {
  const todayKey = kstDayKey(now.toISOString())
  const startKey = kstDayKey(event.startAt)
  if (startKey === todayKey) return 'day_of'
  if (startKey === addDaysKey(todayKey, 1)) return 'day_before'
  // announced : créé récemment ET pas déjà couvert par day_of/day_before
  // (start ≥ J+2). On ignore les events déjà passés.
  if (
    now.getTime() - new Date(event.createdAt).getTime() < ANNOUNCED_WINDOW_MS &&
    startKey > todayKey
  ) {
    return 'announced'
  }
  return null
}

function buildPayload(event: ComebackEvent, kind: NotificationKind): ComebackPayload {
  const label = event.groupName ? `${event.groupName} — ${event.title}` : event.title
  const title =
    kind === 'day_of'
      ? `🔥 Today: ${label}`
      : kind === 'day_before'
        ? `⏳ Tomorrow: ${label}`
        : `🎉 ${label}`
  const body =
    kind === 'day_of'
      ? 'Out today — go check it out'
      : kind === 'day_before'
        ? 'Dropping tomorrow'
        : 'New comeback announced'
  return { title, body, url: event.url }
}

export function buildComebackNotifications(
  subscriptions: readonly ComebackSubscription[],
  follows: readonly ComebackFollow[],
  events: readonly ComebackEvent[],
  alreadySent: ReadonlySet<string>, // clés `userId:eventId:kind`
  now: Date,
  // Types désactivés par user (user_notification_settings enabled=false).
  // Optionnel : sans la map, comportement historique (tout passe).
  disabledTypes?: ReadonlyMap<string, ReadonlySet<string>>,
): ComebackMessage[] {
  // user → groupes suivis
  const groupsByUser = new Map<string, Set<string>>()
  for (const f of follows) {
    const set = groupsByUser.get(f.userId) ?? new Set<string>()
    set.add(f.groupId)
    groupsByUser.set(f.userId, set)
  }

  const messages: ComebackMessage[] = []
  for (const subscription of subscriptions) {
    const followed = groupsByUser.get(subscription.userId)
    if (!followed || followed.size === 0) continue
    const disabled = disabledTypes?.get(subscription.userId)
    for (const event of events) {
      if (!followed.has(event.groupId)) continue
      if (disabled?.has(event.type)) continue
      const kind = resolveKind(event, now)
      if (!kind) continue
      const key = `${subscription.userId}:${event.id}:${kind}`
      if (alreadySent.has(key)) continue
      messages.push({
        subscription,
        payload: buildPayload(event, kind),
        record: { userId: subscription.userId, eventId: event.id, kind },
      })
    }
  }
  return messages
}
