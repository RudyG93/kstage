// Construction du digest quotidien — logique pure et testable (aucun I/O).
// Le cron fournit abonnements + follows + events de la fenêtre, on produit
// un message par abonnement dont le user suit ≥1 groupe ayant ≥1 event.

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

const MAX_LISTED = 3

function buildPayload(events: readonly DigestEvent[]): DigestPayload {
  const n = events.length
  const labels = events.map((e) => (e.groupName ? `${e.groupName} — ${e.title}` : e.title))
  const listed = labels.slice(0, MAX_LISTED).join(', ')
  const more = n > MAX_LISTED ? `, +${n - MAX_LISTED} more` : ''
  return {
    title: `${n} upcoming event${n > 1 ? 's' : ''}`,
    body: listed + more,
    url: '/',
  }
}

export function buildDigest(
  subscriptions: readonly DigestSubscription[],
  follows: readonly DigestFollow[],
  events: readonly DigestEvent[],
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
    messages.push({ subscription, payload: buildPayload(userEvents) })
  }
  return messages
}
