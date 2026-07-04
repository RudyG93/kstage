// Construction du digest — logique pure et testable (aucun I/O).
// Le cron fournit abonnements + follows + events de la fenêtre, on produit
// un message par abonnement dont le user suit ≥1 groupe ayant ≥1 event.
// Deux éditions : 'daily' (fenêtre 48 h) et 'weekly' (lundi, fenêtre 7 j,
// titre « Your k-pop week ») — le choix de l'édition vient du cron.

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
}

export type DigestPayload = { title: string; body: string; url: string }
export type DigestMessage = { subscription: DigestSubscription; payload: DigestPayload }
export type DigestEdition = 'daily' | 'weekly'

const MAX_LISTED = 3

function buildPayload(events: readonly DigestEvent[], edition: DigestEdition): DigestPayload {
  const n = events.length
  const labels = events.map((e) => (e.groupName ? `${e.groupName} — ${e.title}` : e.title))
  const listed = labels.slice(0, MAX_LISTED).join(', ')
  const more = n > MAX_LISTED ? `, +${n - MAX_LISTED} more` : ''
  const title =
    edition === 'weekly'
      ? `Your k-pop week: ${n} event${n > 1 ? 's' : ''}`
      : `${n} upcoming event${n > 1 ? 's' : ''}`
  return { title, body: listed + more, url: '/' }
}

export function buildDigest(
  subscriptions: readonly DigestSubscription[],
  follows: readonly DigestFollow[],
  events: readonly DigestEvent[],
  edition: DigestEdition = 'daily',
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
    const userEvents = sorted.filter((e) => followed.has(e.groupId))
    if (userEvents.length === 0) continue
    messages.push({ subscription, payload: buildPayload(userEvents, edition) })
  }
  return messages
}
