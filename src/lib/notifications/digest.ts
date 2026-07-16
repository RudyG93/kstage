// Construction du digest — logique pure et testable (aucun I/O).
// Le cron fournit abonnements + follows + events de la fenêtre, on produit
// un message par abonnement dont le user suit ≥1 groupe ayant ≥1 event.
// Deux éditions : 'daily' (fenêtre 48 h) et 'weekly' (lundi, fenêtre 7 j,
// titre « Your k-pop week ») — le choix de l'édition vient du cron.

import { withPushSrc } from './push-url'

export type DigestSubscription = {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
}

export type DigestFollow = { userId: string; groupId: string }

export type DigestEvent = {
  groupId: string
  title: string
  startAt: string
  groupName?: string | null
  // Sert à agréger les music shows par épisode dans le payload (optionnel :
  // les anciens appelants/tests sans type gardent le comportement historique).
  type?: string | null
  // confirmed | tentative — projeté pour la politique « pas d'alerte à heure
  // précise sur une date sans heure » (audit §7.5) ; le digest ne cite aucune
  // heure, tous les statuts non-cancelled y sont légitimes.
  status?: string | null
}

export type DigestPayload = { title: string; body: string; url: string; tag?: string }
export type DigestMessage = { subscription: DigestSubscription; payload: DigestPayload }
export type DigestEdition = 'daily' | 'weekly'

const MAX_LISTED = 3

/**
 * Labels du corps : un même music show posé sur N groupes (title+startAt
 * identiques) devient UNE entrée « Music Bank (5 artists) » au lieu de N
 * lignes redondantes — même logique que groupMusicShowEpisodes à l'affichage.
 */
function digestLabels(events: readonly DigestEvent[]): string[] {
  const labels: string[] = []
  const episodes = new Map<string, { title: string; names: string[]; index: number }>()
  for (const e of events) {
    if (e.type === 'music_show') {
      const key = `${e.title}|${e.startAt}`
      const ep = episodes.get(key)
      if (ep) {
        ep.names.push(e.groupName ?? '?')
        continue
      }
      episodes.set(key, { title: e.title, names: [e.groupName ?? '?'], index: labels.length })
      labels.push('') // rempli après, une fois le lineup complet connu
      continue
    }
    labels.push(e.groupName ? `${e.groupName} — ${e.title}` : e.title)
  }
  for (const ep of episodes.values()) {
    labels[ep.index] =
      ep.names.length === 1
        ? `${ep.names[0]} — ${ep.title}`
        : ep.names.length === 2
          ? `${ep.title} (${ep.names[0]}, ${ep.names[1]})`
          : `${ep.title} (${ep.names.length} artists)`
  }
  return labels
}

function buildPayload(events: readonly DigestEvent[], edition: DigestEdition): DigestPayload {
  const labels = digestLabels(events)
  const n = labels.length
  // « · » : plus lisible que la virgule dans le body système (retour Rudy
  // 2026-07-12, audit notifs).
  const listed = labels.slice(0, MAX_LISTED).join(' · ')
  const more = n > MAX_LISTED ? ` · +${n - MAX_LISTED} more` : ''
  // Titre quotidien parlant (« 3 upcoming events » était sec et sans marque).
  const title =
    edition === 'weekly'
      ? `Your k-pop week: ${n} event${n > 1 ? 's' : ''}`
      : `Today in k-pop: ${n} event${n > 1 ? 's' : ''}`
  // Deep link : le digest liste des events datés → le calendrier est la
  // destination utile (la home re-priorise le hero, pas la liste).
  // tag : le digest du jour REMPLACE celui d'hier au lieu de s'empiler.
  return { title, body: listed + more, url: withPushSrc('/calendar'), tag: 'digest' }
}

export function buildDigest(
  subscriptions: readonly DigestSubscription[],
  follows: readonly DigestFollow[],
  events: readonly DigestEvent[],
  edition: DigestEdition = 'daily',
  // Types désactivés par user (user_notification_settings enabled=false).
  // Optionnel : sans la map, comportement historique (tout passe).
  disabledTypes?: ReadonlyMap<string, ReadonlySet<string>>,
): DigestMessage[] {
  const groupsByUser = new Map<string, Set<string>>()
  for (const f of follows) {
    const set = groupsByUser.get(f.userId) ?? new Set<string>()
    set.add(f.groupId)
    groupsByUser.set(f.userId, set)
  }

  const sorted = [...events].sort((a, b) => a.startAt.localeCompare(b.startAt))

  const messages: DigestMessage[] = []
  for (const subscription of subscriptions) {
    const followed = groupsByUser.get(subscription.userId)
    if (!followed || followed.size === 0) continue
    const disabled = disabledTypes?.get(subscription.userId)
    // Filtre AVANT digestLabels : le compte du titre et l'agrégation music_show
    // ne voient que les events pertinents. Event sans type → conservé (compat).
    const userEvents = sorted.filter(
      (e) => followed.has(e.groupId) && !(e.type && disabled?.has(e.type)),
    )
    if (userEvents.length === 0) continue
    messages.push({ subscription, payload: buildPayload(userEvents, edition) })
  }
  return messages
}
