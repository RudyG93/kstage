// Construction des push datés par comeback (§7) — logique pure et testable
// (aucun I/O). Le cron fournit abonnements + follows + comebacks (events mv/release)
// + l'ensemble des triggers déjà envoyés ; on produit un message par (abonnement,
// event, kind) pertinent et non encore envoyé.
//
// Un comeback déclenche jusqu'à 2 push au fil du temps :
//   day_before (J-1) → day_of (jour J).
// Le kind `announced` (event ajouté en DB < 24 h) a été COUPÉ (Phase 1 Lot 4,
// budget de notifications — audit §7.3) : l'annonce vit dans le digest quotidien,
// le push est réservé aux échéances. Fenêtres calées sur le JOUR LOCAL de chaque
// abonné (`timeZones` userId→IANA, Lot 3b) — « Today » doit être vrai chez lui ;
// défaut KST (référence k-pop) pour les abonnés sans fuseau connu. Précédence
// pour qu'un même run n'émette qu'UN kind par event : day_of > day_before.
//
// Politique `tentative` : un jour connu sans heure (stocké minuit KST) reste
// éligible à day_before/day_of — aucun kind existant n'annonce d'heure dans son
// copy. Tout FUTUR kind à heure précise (« dans 15 min ») devra exclure
// `status === 'tentative'` / `isTimeTBA` (audit §7.5 : une date sans heure ne
// déclenche jamais d'alerte minute-précise).

import { localDayKey } from '@/lib/events/date'
import { withPushSrc } from './push-url'

const DEFAULT_TIME_ZONE = 'Asia/Seoul'

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
  status: string // confirmed | tentative (cancelled filtré côté route)
  url: string // déjà résolu (eventHref) côté route
  // Tier de confiance du groupe (Phase 3 Lot 2, audit §4.1) + type de la
  // source de l'event. Optionnels : absents = comportement historique.
  confidence?: 'verified' | 'monitored' | 'candidate' | null
  sourceType?: string | null
}

/**
 * Gate de confiance (audit §4.1) — partagé comebacks/digest :
 *   candidate : JAMAIS notifié (identité encore ambiguë) ;
 *   monitored : seulement les données à forte confiance (status confirmed
 *               OU source youtube_api — un MV posté sur la chaîne est un fait) ;
 *   verified / champ absent : comportement historique.
 */
export function passesConfidenceGate(event: {
  confidence?: 'verified' | 'monitored' | 'candidate' | null
  status?: string | null
  sourceType?: string | null
}): boolean {
  if (event.confidence === 'candidate') return false
  if (event.confidence === 'monitored') {
    return event.status === 'confirmed' || event.sourceType === 'youtube_api'
  }
  return true
}

export type NotificationKind = 'day_before' | 'day_of'

export type ComebackPayload = { title: string; body: string; url: string; tag?: string }
export type ComebackRecord = { userId: string; eventId: string; kind: NotificationKind }
export type ComebackMessage = {
  subscription: ComebackSubscription
  payload: ComebackPayload
  record: ComebackRecord
}

// Arithmétique PURE sur la clé 'YYYY-MM-DD' — surtout pas de round-trip par un
// fuseau : `localDayKey(minuit UTC du jour X, tz négatif)` rendrait X-1.
const addDaysKey = (key: string, days: number): string => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/**
 * Le `kind` applicable à un event au moment `now`, dans le fuseau de l'abonné,
 * ou null si aucun. Précédence day_of > day_before → un seul kind par run.
 */
function resolveKind(event: ComebackEvent, now: Date, timeZone: string): NotificationKind | null {
  const todayKey = localDayKey(now.toISOString(), timeZone)
  const startKey = localDayKey(event.startAt, timeZone)
  if (startKey === todayKey) return 'day_of'
  if (startKey === addDaysKey(todayKey, 1)) return 'day_before'
  return null
}

function buildPayload(event: ComebackEvent, kind: NotificationKind): ComebackPayload {
  const label = event.groupName ? `${event.groupName} — ${event.title}` : event.title
  // Copy « Out now » : depuis le passage du cron APRÈS le scan du soir
  // (10:45 UTC = 19:45 KST), le push jour J part après le créneau de drop
  // 18:00 KST — « c'est sorti », plus « ça sort aujourd'hui ».
  const title = kind === 'day_of' ? `🔥 Out now: ${label}` : `⏳ Tomorrow: ${label}`
  const body = kind === 'day_of' ? 'Just dropped — go watch' : 'Dropping tomorrow'
  // tag par event : les rappels successifs du même comeback (J-1 → jour J)
  // se REMPLACENT dans le tiroir au lieu de s'empiler.
  return { title, body, url: withPushSrc(event.url), tag: `comeback-${event.id}` }
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
  // Fuseau IANA par user (profiles.timezone, déjà validé côté route).
  // Optionnel : sans la map, comportement historique (KST pour tous). Un même
  // event peut être day_of chez l'un et day_before chez l'autre — voulu ; la
  // dédup userId:eventId:kind garantit toujours ≤ 2 push par event par user.
  timeZones?: ReadonlyMap<string, string>,
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
    const timeZone = timeZones?.get(subscription.userId) ?? DEFAULT_TIME_ZONE
    for (const event of events) {
      if (!followed.has(event.groupId)) continue
      if (!passesConfidenceGate(event)) continue
      if (disabled?.has(event.type)) continue
      const kind = resolveKind(event, now, timeZone)
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
