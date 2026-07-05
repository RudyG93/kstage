import { describe, it, expect } from 'vitest'
import {
  escapeIcsText,
  foldIcsLine,
  icsDateTimeUtc,
  icsDate,
  buildIcsCalendar,
  type IcsEvent,
} from './build'

describe('escapeIcsText', () => {
  it('échappe backslash, point-virgule, virgule et newlines', () => {
    expect(escapeIcsText('a\\b;c,d')).toBe('a\\\\b\\;c\\,d')
    expect(escapeIcsText('ligne1\nligne2')).toBe('ligne1\\nligne2')
    expect(escapeIcsText('crlf\r\nfin')).toBe('crlf\\nfin')
  })
  it('laisse le texte simple intact', () => {
    expect(escapeIcsText('Golden Hour Part 3')).toBe('Golden Hour Part 3')
  })
})

describe('foldIcsLine', () => {
  it('ligne courte : inchangée', () => {
    expect(foldIcsLine('SUMMARY:court')).toEqual(['SUMMARY:court'])
  })
  it('ligne ASCII longue : coupée à 75 octets, continuation avec espace', () => {
    const line = 'SUMMARY:' + 'a'.repeat(100)
    const folded = foldIcsLine(line)
    expect(folded.length).toBe(2)
    expect(new TextEncoder().encode(folded[0]).length).toBeLessThanOrEqual(75)
    expect(folded[1].startsWith(' ')).toBe(true)
    // Recomposition sans perte (unfold = concat sans l'espace de tête).
    expect(folded[0] + folded[1].slice(1)).toBe(line)
  })
  it('hangul (3 octets/char) : jamais coupé au milieu d’une séquence UTF-8', () => {
    const line = 'SUMMARY:' + '세븐틴'.repeat(15) // 8 + 135 octets
    const folded = foldIcsLine(line)
    expect(folded.length).toBeGreaterThan(1)
    for (const l of folded) {
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
      // Chaque morceau doit être de l'UTF-16 valide re-encodable (pas de
      // demi-séquence) : l'encode/decode round-trip est l'assertion.
      expect(new TextDecoder().decode(new TextEncoder().encode(l))).toBe(l)
    }
    expect(folded.map((l, i) => (i === 0 ? l : l.slice(1))).join('')).toBe(line)
  })
})

describe('dates', () => {
  it('icsDateTimeUtc convertit en UTC compact', () => {
    expect(icsDateTimeUtc('2026-07-10T08:00:00+00:00')).toBe('20260710T080000Z')
    expect(icsDateTimeUtc('2026-07-10T10:30:00+02:00')).toBe('20260710T083000Z')
  })
  it('icsDate compacte un jour', () => {
    expect(icsDate('2026-07-12')).toBe('20260712')
  })
})

describe('buildIcsCalendar', () => {
  const timed: IcsEvent = {
    uid: 'evt-1@kstage',
    summary: 'ATEEZ — Golden Hour, Part 3',
    start: { kind: 'datetime', iso: '2026-07-10T08:00:00+00:00' },
    end: { kind: 'datetime', iso: '2026-07-10T09:00:00+00:00' },
    description: 'Comeback · via KStage',
    url: 'https://kstage.vercel.app/mv/golden-hour-part-3',
    dtstampIso: '2026-07-01T09:30:00+00:00',
  }
  const allDay: IcsEvent = {
    uid: 'anniv-bday-g1-Karina-2026@kstage',
    summary: 'Karina turns 26',
    start: { kind: 'date', day: '2026-07-12' },
    end: { kind: 'date', day: '2026-07-13' },
    dtstampIso: '2026-07-12T00:00:00+00:00',
  }

  it('structure VCALENDAR complète, CRLF, déterministe', () => {
    const ics = buildIcsCalendar([timed, allDay], { calName: 'KStage — My groups' })
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('UID:evt-1@kstage')
    expect(ics).toContain('DTSTART:20260710T080000Z')
    expect(ics).toContain('DTEND:20260710T090000Z')
    // Virgule du SUMMARY échappée.
    expect(ics).toContain('SUMMARY:ATEEZ — Golden Hour\\, Part 3')
    expect(ics).toContain('URL:https://kstage.vercel.app/mv/golden-hour-part-3')
    // All-day : VALUE=DATE, DTEND j+1.
    expect(ics).toContain('DTSTART;VALUE=DATE:20260712')
    expect(ics).toContain('DTEND;VALUE=DATE:20260713')
    // Déterminisme : deux appels identiques → même sortie.
    expect(buildIcsCalendar([timed, allDay], { calName: 'KStage — My groups' })).toBe(ics)
    // Aucune ligne > 75 octets.
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })

  it('calendrier vide : VCALENDAR valide sans VEVENT', () => {
    const ics = buildIcsCalendar([], { calName: 'KStage' })
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })
})
