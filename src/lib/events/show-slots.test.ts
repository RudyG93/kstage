import { describe, it, expect } from 'vitest'
import { generateShowSlots, isSyntheticSlot } from './show-slots'

// Semaine réelle du 13 au 19 juillet 2026 (lundi→dimanche KST) :
// The Show mar 18:00 KST = 09:00Z · Show Champion mer 17:00 = 08:00Z ·
// M Countdown jeu 18:00 = 09:00Z · Music Bank ven 17:00 = 08:00Z ·
// Music Core sam 15:15 = 06:15Z · Inkigayo dim 15:25 = 06:25Z.
const FROM = '2026-07-13T00:00:00.000Z'
const TO = '2026-07-20T00:00:00.000Z'
// now AVANT la fenêtre : le clamp interne « jamais dans le passé » ne mord pas.
const NOW = Date.parse('2026-07-12T00:00:00.000Z')

describe('generateShowSlots', () => {
  it('génère les 6 shows de la semaine aux bons instants UTC', () => {
    const slots = generateShowSlots({ fromIso: FROM, toIso: TO, existing: [], nowMs: NOW })
    expect(slots).toHaveLength(6)
    expect(slots.map((s) => s.title)).toEqual([
      'The Show',
      'Show Champion',
      'M Countdown',
      'Music Bank',
      'Music Core',
      'Inkigayo',
    ])
    expect(slots[0].start_at).toBe('2026-07-14T09:00:00.000Z') // The Show mar 18:00 KST
    expect(slots[4].start_at).toBe('2026-07-18T06:15:00.000Z') // Music Core sam 15:15 KST
    expect(slots.every((s) => s.type === 'music_show' && s.status === 'tentative')).toBe(true)
    expect(slots.every(isSyntheticSlot)).toBe(true)
  })

  it('dédup : un épisode réel du même show le même jour KST remplace le slot', () => {
    const real = {
      type: 'music_show',
      title: 'Music Bank',
      // L'heure réelle peut différer du créneau théorique — seul le jour compte.
      start_at: '2026-07-17T06:15:00.000Z',
    }
    const slots = generateShowSlots({ fromIso: FROM, toIso: TO, existing: [real], nowMs: NOW })
    expect(slots).toHaveLength(5)
    expect(slots.some((s) => s.title === 'Music Bank')).toBe(false)
  })

  it('un épisode réel un AUTRE jour ne consomme pas le slot', () => {
    const real = { type: 'music_show', title: 'Music Bank', start_at: '2026-07-10T08:00:00.000Z' }
    const slots = generateShowSlots({ fromIso: FROM, toIso: TO, existing: [real], nowMs: NOW })
    expect(slots.some((s) => s.title === 'Music Bank')).toBe(true)
  })

  it('respecte la borne basse : pas de slot avant fromIso (pas de fausse histoire)', () => {
    // From = mercredi 15/07 12:00Z → The Show (mardi) et Show Champion (mer
    // 08:00Z) sont passés, il reste 4 shows.
    const slots = generateShowSlots({
      fromIso: '2026-07-15T12:00:00.000Z',
      toIso: TO,
      existing: [],
      nowMs: NOW,
    })
    expect(slots.map((s) => s.title)).toEqual([
      'M Countdown',
      'Music Bank',
      'Music Core',
      'Inkigayo',
    ])
  })

  it('fenêtre invalide ou vide → []', () => {
    expect(generateShowSlots({ fromIso: TO, toIso: FROM, existing: [], nowMs: NOW })).toEqual([])
    expect(generateShowSlots({ fromIso: 'garbage', toIso: TO, existing: [], nowMs: NOW })).toEqual(
      [],
    )
  })

  it('clamp : une borne basse dans le passé est ramenée à maintenant', () => {
    // now = jeudi 16/07 12:00Z → même avec fromIso au lundi, seuls les shows
    // restants de la semaine sortent.
    const slots = generateShowSlots({
      fromIso: FROM,
      toIso: TO,
      existing: [],
      nowMs: Date.parse('2026-07-16T12:00:00.000Z'),
    })
    expect(slots.map((s) => s.title)).toEqual(['Music Bank', 'Music Core', 'Inkigayo'])
  })

  it('les non-music_show existants ne dédupent rien', () => {
    const mv = { type: 'mv', title: 'Music Bank', start_at: '2026-07-17T08:00:00.000Z' }
    const slots = generateShowSlots({ fromIso: FROM, toIso: TO, existing: [mv], nowMs: NOW })
    expect(slots).toHaveLength(6)
  })
})
