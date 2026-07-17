// Construction du digest — logique pure et testable (aucun I/O).
// Le cron fournit abonnements + follows + events de la fenêtre, on produit
// un message par abonnement dont le user suit ≥1 groupe ayant ≥1 event.
// Deux éditions : 'daily' (fenêtre 48 h) et 'weekly' (lundi, fenêtre 7 j,
// titre « Your k-pop week ») — le choix de l'édition vient du cron.

import { localDayKey } from '@/lib/events/date'
import { withPushSrc } from './push-url'
import { passesConfidenceGate } from './comebacks'

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
  // Tier de confiance du groupe + type de source (Phase 3 Lot 2) — mêmes
  // règles que le push (cf. passesConfidenceGate). Absents = historique.
  confidence?: 'verified' | 'monitored' | 'candidate' | null
  sourceType?: string | null
}

export type DigestPayload = { title: string; body: string; url: string; tag?: string }
export type DigestMessage = { subscription: DigestSubscription; payload: DigestPayload }
export type DigestEdition = 'daily' | 'weekly'

const MAX_LISTED = 3

/**
 * Entrées du digest : un même music show posé sur N groupes (title+startAt
 * identiques) devient UNE entrée « Music Bank (5 artists) » au lieu de N
 * lignes redondantes — même logique que groupMusicShowEpisodes à l'affichage.
 * Chaque entrée garde son startAt pour l'étiquette de jour.
 */
function digestEntries(events: readonly DigestEvent[]): { label: string; startAt: string }[] {
  const entries: { label: string; startAt: string }[] = []
  const episodes = new Map<string, { title: string; names: string[]; index: number }>()
  for (const e of events) {
    if (e.type === 'music_show') {
      const key = `${e.title}|${e.startAt}`
      const ep = episodes.get(key)
      if (ep) {
        ep.names.push(e.groupName ?? '?')
        continue
      }
      episodes.set(key, { title: e.title, names: [e.groupName ?? '?'], index: entries.length })
      entries.push({ label: '', startAt: e.startAt }) // rempli après, lineup complet connu
      continue
    }
    entries.push({
      label: e.groupName ? `${e.groupName} — ${e.title}` : e.title,
      startAt: e.startAt,
    })
  }
  for (const ep of episodes.values()) {
    entries[ep.index].label =
      ep.names.length === 1
        ? `${ep.names[0]} — ${ep.title}`
        : ep.names.length === 2
          ? `${ep.title} (${ep.names[0]}, ${ep.names[1]})`
          : `${ep.title} (${ep.names.length} artists)`
  }
  return entries
}

/** « today » / « tomorrow » / « Sat » — jour de l'event dans le fuseau de l'abonné. */
function dayTag(startAt: string, timeZone: string, nowIso: string): string {
  const eventKey = localDayKey(startAt, timeZone)
  const todayKey = localDayKey(nowIso, timeZone)
  if (eventKey === todayKey) return 'today'
  // Comparaison de clés YYYY-MM-DD en jours (pas d'heure → pas de DST).
  const diff = Math.round((Date.parse(eventKey) - Date.parse(todayKey)) / 86_400_000)
  if (diff === 1) return 'tomorrow'
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(new Date(startAt))
}

/**
 * Wording event-led (retour Rudy 2026-07-17) : l'OS affiche déjà « from
 * KStage », nos titres ne re-citent ni la marque ni « in k-pop ». Le titre
 * porte l'event LE PLUS PROCHE avec son jour ; le body liste la suite avec
 * l'étiquette de jour de chaque entrée (« Tomorrow: … »). Jours calculés dans
 * le fuseau de l'abonné.
 */
function buildPayload(
  events: readonly DigestEvent[],
  edition: DigestEdition,
  timeZone: string,
  nowIso: string,
): DigestPayload {
  const entries = digestEntries(events)
  const n = entries.length
  const tagOf = (e: { startAt: string }) => dayTag(e.startAt, timeZone, nowIso)

  // Body : « · » plus lisible que la virgule (retour Rudy 2026-07-12) ;
  // l'étiquette de jour n'est répétée que quand elle change (Capitalisée).
  const bodyOf = (list: readonly { label: string; startAt: string }[], skipped: number) => {
    let lastTag = ''
    const parts = list.map((e) => {
      const t = tagOf(e)
      const prefix = t === lastTag ? '' : `${t[0].toUpperCase()}${t.slice(1)}: `
      lastTag = t
      return `${prefix}${e.label}`
    })
    const more = skipped > 0 ? ` · +${skipped} more` : ''
    return parts.join(' · ') + more
  }

  if (edition === 'weekly') {
    return {
      title: `Your k-pop week: ${n} event${n > 1 ? 's' : ''}`,
      body: bodyOf(entries.slice(0, MAX_LISTED), n - Math.min(n, MAX_LISTED)),
      url: withPushSrc('/calendar'),
      tag: 'digest', // le digest du jour REMPLACE celui d'hier au lieu de s'empiler
    }
  }

  // Daily : entrée la plus proche en titre, la suite dans le body.
  const [first, ...rest] = entries
  const title = `${first.label} · ${tagOf(first)}`
  const listed = rest.slice(0, MAX_LISTED)
  return {
    title,
    body: bodyOf(listed, rest.length - listed.length),
    url: withPushSrc('/calendar'),
    tag: 'digest',
  }
}

export function buildDigest(
  subscriptions: readonly DigestSubscription[],
  follows: readonly DigestFollow[],
  events: readonly DigestEvent[],
  edition: DigestEdition = 'daily',
  // Types désactivés par user (user_notification_settings enabled=false).
  // Optionnel : sans la map, comportement historique (tout passe).
  disabledTypes?: ReadonlyMap<string, ReadonlySet<string>>,
  // Fuseau IANA par user (profiles.timezone, validé côté route) — sert les
  // étiquettes de jour du payload. Défaut KST (référence k-pop).
  timeZones?: ReadonlyMap<string, string>,
  // Instant du run, injectable pour des tests déterministes.
  nowIso: string = new Date().toISOString(),
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
    // Gate de confiance (Phase 3 Lot 2) : candidate jamais, monitored seulement
    // confirmed/youtube_api — même règle que le push.
    const userEvents = sorted.filter(
      (e) =>
        followed.has(e.groupId) && passesConfidenceGate(e) && !(e.type && disabled?.has(e.type)),
    )
    if (userEvents.length === 0) continue
    const timeZone = timeZones?.get(subscription.userId) ?? 'Asia/Seoul'
    messages.push({ subscription, payload: buildPayload(userEvents, edition, timeZone, nowIso) })
  }
  return messages
}
