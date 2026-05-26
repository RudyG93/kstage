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

/** Clé de jour 'YYYY-MM-DD' du moment, lue en heure de Séoul. */
export function kstDayKey(iso: string): string {
  const d = new Date(new Date(iso).getTime() + KST_OFFSET_MS)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Regroupe des events par jour KST. */
export function groupEventsByKstDay<T extends { start_at: string }>(
  events: readonly T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const event of events) {
    const key = kstDayKey(event.start_at)
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
