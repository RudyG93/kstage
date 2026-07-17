// Helpers de date purs et testables. KST = UTC+9, sans DST.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * Bornes d'un mois exprimées en heure de Séoul, renvoyées en UTC ISO
 * pour servir de filtre `.gte(start) / .lt(end)` côté DB.
 * @param month 1-12
 */
export function getKstMonthRange(year: number, month: number) {
  const startISO = new Date(Date.UTC(year, month - 1, 1) - KST_OFFSET_MS).toISOString()
  const endISO = new Date(Date.UTC(year, month, 1) - KST_OFFSET_MS).toISOString()
  return { startISO, endISO }
}

/** Date ISO strictement future ? (nowMs injectable — purity lint des RSC.) */
export function isFutureDate(iso: string | null | undefined, nowMs = Date.now()): boolean {
  return !!iso && Date.parse(iso) > nowMs
}

/**
 * Convertit une horloge KST (heure de Séoul, UTC+9 sans DST) en UTC ISO.
 * @param monthIndex 0-11
 */
export function kstToUtcISO(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
): string {
  return new Date(Date.UTC(year, monthIndex, day, hour, minute) - KST_OFFSET_MS).toISOString()
}

/**
 * Un event `tentative` stocké à MINUIT KST (heure technique par défaut de
 * kstToUtcISO) = jour connu, heure inconnue → les surfaces affichent « Time TBA »
 * et suppriment le countdown minute ; le D-day reste honnête. Le test minuit
 * exclut les slots music-show (tentative mais à l'heure réelle du show).
 */
export const isTimeTBA = (e: { status?: string | null; start_at?: string | null }): boolean =>
  e.status === 'tentative' && !!e.start_at && kstTime24h(e.start_at) === '00:00'

/**
 * Clé de jour 'YYYY-MM-DD' d'un instant, lue dans un fuseau IANA donné.
 * Via Intl (résout DST + offsets), contrairement à un offset fixe.
 */
export function localDayKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Clé de jour 'YYYY-MM-DD' du moment, lue en heure de Séoul. */
export function kstDayKey(iso: string): string {
  return localDayKey(iso, 'Asia/Seoul')
}

/**
 * Bornes UTC [from, to) du jour KST contenant l'instant donné. Sert les
 * requêtes « même épisode ce jour-là » du scraper music shows (l'idempotence
 * par jour KST — le carrd révise parfois l'heure d'un épisode).
 */
export function kstDayBounds(iso: string): { from: string; to: string } {
  const day = kstDayKey(iso) // YYYY-MM-DD en KST
  const fromMs = Date.parse(`${day}T00:00:00+09:00`)
  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(fromMs + 24 * 60 * 60 * 1000).toISOString(),
  }
}

/** Regroupe des events par jour dans un fuseau IANA donné. */
export function groupEventsByDay<T extends { start_at: string }>(
  events: readonly T[],
  timeZone: string,
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const event of events) {
    const key = localDayKey(event.start_at, timeZone)
    const bucket = map.get(key)
    if (bucket) bucket.push(event)
    else map.set(key, [event])
  }
  return map
}

/** Regroupe des events par jour KST. */
export function groupEventsByKstDay<T extends { start_at: string }>(
  events: readonly T[],
): Map<string, T[]> {
  return groupEventsByDay(events, 'Asia/Seoul')
}

/**
 * Clé de jour d'un EVENT, consciente de sa sémantique :
 * - `anniversary` = DATE PURE (l'anniversaire de Wonwoo est le 17 juillet dans
 *   tous les fuseaux). Les générateurs l'ancrent à minuit KST → la lire en KST
 *   retrouve la date civile ; la lire dans le fuseau du viewer la ferait
 *   glisser à J-1 partout à l'ouest de Séoul (bug du 2026-07-17).
 * - tout le reste = instant réel → jour local du viewer (cohérent avec l'heure
 *   locale mise en avant et le day_of des push).
 */
export function eventDayKey(
  event: { start_at: string; type?: string | null },
  timeZone: string,
): string {
  return localDayKey(event.start_at, event.type === 'anniversary' ? 'Asia/Seoul' : timeZone)
}

/** Regroupe des events par jour, dates pures (anniversaires) comprises. */
export function groupEventsByEventDay<T extends { start_at: string; type?: string | null }>(
  events: readonly T[],
  timeZone: string,
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const event of events) {
    const key = eventDayKey(event, timeZone)
    const bucket = map.get(key)
    if (bucket) bucket.push(event)
    else map.set(key, [event])
  }
  return map
}

export function formatEventDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(iso))
}

/**
 * Formate un instant en heure de Séoul (KST), locale en-US, avec les champs
 * Intl voulus. Source unique : remplace les helpers `kstFormat` qui étaient
 * copiés à l'identique dans event-card, home/event-card et la page /mv/[slug].
 */
export function formatKst(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', ...opts }).format(new Date(iso))
}

/**
 * Heure KST en 24 h (« 18:00 ») — la référence k-pop, mise en avant.
 * `hourCycle: 'h23'` (pas `hour12: false`) : selon la version ICU, hour12:false
 * résout en cycle h24 et rend minuit « 24:30 » (Node 20 = la CI rouge du
 * 17/06 → 05/07 ; idem vieux navigateurs). h23 garantit « 00:30 » partout.
 */
export function kstTime24h(iso: string): string {
  return formatKst(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

/**
 * Temps relatif court (« just now », « 5m ago », « 3h ago », « 2d ago »,
 * « 3w ago », « 5mo ago », « 1y ago ») — impl unique pour sidebar, commentaires
 * et fiche MV (3 copies locales consolidées, audit 2026-07-04).
 */
export function relativeTime(iso: string, nowMs = Date.now()): string {
  const min = Math.floor((nowMs - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  if (d < 35) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  const y = Math.floor(d / 365)
  return `${y}y ago`
}

/** « JUN 28 » — date courte uppercased (listes denses), fuseau paramétrable. */
export function shortDate(iso: string, timeZone = 'Asia/Seoul'): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone })
    .format(new Date(iso))
    .toUpperCase()
}

/** « Mar 2026 » — mois + année (profil « Fan since » en UTC ; cartes MV / Top
 * Rated en KST — retour Rudy R7 : mois-année, pas de jour ni d'apostrophe). */
export function monthYear(iso: string, timeZone = 'UTC'): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    timeZone,
  }).format(new Date(iso))
}

/**
 * Étiquette D-day (« D-2 », « D-DAY ») d'un event, en jours calendaires dans le
 * fuseau donné (Data Desk : colonne D-day des queues, tags hero/tuiles).
 * Passé → « D+n » (ne devrait pas s'afficher : les queues sont future-only).
 */
export function formatDDay(iso: string, timeZone: string, nowIso?: string): string {
  return ddayFromKeys(
    localDayKey(iso, timeZone),
    localDayKey(nowIso ?? new Date().toISOString(), timeZone),
  )
}

/** D-day d'un EVENT : date civile pour les anniversaires, jour local sinon (cf. eventDayKey). */
export function eventDDay(
  event: { start_at: string; type?: string | null },
  timeZone: string,
  nowIso?: string,
): string {
  return ddayFromKeys(
    eventDayKey(event, timeZone),
    localDayKey(nowIso ?? new Date().toISOString(), timeZone),
  )
}

function ddayFromKeys(eventKey: string, todayKey: string): string {
  // Les clés YYYY-MM-DD se comparent en jours via Date.UTC (pas d'heure → pas de DST).
  const days = Math.round((Date.parse(eventKey) - Date.parse(todayKey)) / 86_400_000)
  if (days === 0) return 'D-DAY'
  return days > 0 ? `D-${days}` : `D+${-days}`
}
