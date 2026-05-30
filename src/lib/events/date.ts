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

export function formatEventDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(iso))
}
