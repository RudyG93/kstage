// Générateur iCalendar (RFC 5545) — logique pure, aucune I/O.
// Choix V1 (cf. JOURNAL 2026-07-05) : tout en UTC `Z` (aucun VTIMEZONE requis),
// DTSTAMP déterministe (created_at, pas now()) → output stable et testable,
// folding byte-aware à 75 octets (le hangul = 3 octets/char UTF-8 — Google
// tolère les lignes longues, Outlook non).

export type IcsWhen = { kind: 'datetime'; iso: string } | { kind: 'date'; day: string }

export interface IcsEvent {
  uid: string
  summary: string
  start: IcsWhen
  end?: IcsWhen
  description?: string
  url?: string
  dtstampIso: string
}

/** Échappement TEXT (RFC 5545 §3.3.11) : \ ; , et newlines ; strip \r. */
export function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n')
}

const encoder = new TextEncoder()

/**
 * Folding RFC 5545 §3.1 : lignes ≤ 75 octets UTF-8, continuation = 1 espace en
 * tête (le CRLF est posé au join). Coupe SANS scinder une séquence UTF-8
 * multi-octets : on accumule caractère par caractère en mesurant les octets.
 */
export function foldIcsLine(line: string): string[] {
  if (encoder.encode(line).length <= 75) return [line]
  const out: string[] = []
  let current = ''
  let currentBytes = 0
  // 1ʳᵉ ligne : 75 octets ; continuations : 74 (l'espace de tête compte).
  let limit = 75
  for (const ch of line) {
    const chBytes = encoder.encode(ch).length
    if (currentBytes + chBytes > limit) {
      out.push(current)
      current = ' '
      currentBytes = 1
      limit = 75
    }
    current += ch
    currentBytes += chBytes
  }
  if (current) out.push(current)
  return out
}

/** '2026-07-10T09:00:00+00:00' (ou Z) → '20260710T090000Z' */
export function icsDateTimeUtc(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

/** '2026-07-10' → '20260710' */
export function icsDate(day: string): string {
  return day.replace(/-/g, '')
}

function whenProp(name: 'DTSTART' | 'DTEND', when: IcsWhen): string {
  return when.kind === 'date'
    ? `${name};VALUE=DATE:${icsDate(when.day)}`
    : `${name}:${icsDateTimeUtc(when.iso)}`
}

/**
 * Assemble le VCALENDAR complet : CRLF entre chaque ligne (RFC 5545 §3.1),
 * toutes les lignes foldées. Déterministe (aucun now()).
 */
export function buildIcsCalendar(events: readonly IcsEvent[], opts: { calName: string }): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KStage//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(opts.calName)}`,
    // Google ignore ces hints (poll ~12-24 h fixe), Apple les honore.
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ]

  for (const e of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${e.uid}`)
    lines.push(`DTSTAMP:${icsDateTimeUtc(e.dtstampIso)}`)
    lines.push(whenProp('DTSTART', e.start))
    if (e.end) lines.push(whenProp('DTEND', e.end))
    lines.push(`SUMMARY:${escapeIcsText(e.summary)}`)
    if (e.description) lines.push(`DESCRIPTION:${escapeIcsText(e.description)}`)
    if (e.url) lines.push(`URL:${e.url}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.flatMap(foldIcsLine).join('\r\n') + '\r\n'
}
