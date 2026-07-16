import { describe, it, expect } from 'vitest'
import {
  PRODUCT_EVENTS,
  CLIENT_ALLOWED_EVENTS,
  DEDUPE_POLICY,
  isProductEvent,
  sanitizeProps,
} from './events'

describe('vocabulaire', () => {
  it('isProductEvent : accepte le vocabulaire, rejette le reste', () => {
    expect(isProductEvent('calendar_opened')).toBe(true)
    expect(isProductEvent('made_up_event')).toBe(false)
    expect(isProductEvent(42)).toBe(false)
    expect(isProductEvent(null)).toBe(false)
  })

  it('CLIENT_ALLOWED_EVENTS ⊂ PRODUCT_EVENTS et exclut les jalons serveur', () => {
    for (const e of CLIENT_ALLOWED_EVENTS) expect(PRODUCT_EVENTS).toContain(e)
    // Un client ne peut pas fabriquer les jalons critiques du funnel.
    expect(CLIENT_ALLOWED_EVENTS.has('signup_completed')).toBe(false)
    expect(CLIENT_ALLOWED_EVENTS.has('first_group_followed')).toBe(false)
    expect(CLIENT_ALLOWED_EVENTS.has('three_groups_followed')).toBe(false)
  })

  it('DEDUPE_POLICY : jalons à vie en once, north-star en daily', () => {
    expect(DEDUPE_POLICY.signup_completed).toBe('once')
    expect(DEDUPE_POLICY.first_group_followed).toBe('once')
    expect(DEDUPE_POLICY.three_groups_followed).toBe('once')
    expect(DEDUPE_POLICY.personal_calendar_ready).toBe('once')
    expect(DEDUPE_POLICY.ical_enabled).toBe('once')
    expect(DEDUPE_POLICY.calendar_opened).toBe('daily')
    // Chaque occurrence compte pour les signaux de volume.
    expect(DEDUPE_POLICY.search_no_results).toBeUndefined()
    expect(DEDUPE_POLICY.landing_cta_clicked).toBeUndefined()
  })
})

describe('sanitizeProps', () => {
  it('ne garde que les clés whitelistées de l’event', () => {
    expect(sanitizeProps('landing_cta_clicked', { cta: 'signup', evil: 'x', q: 'nope' })).toEqual({
      cta: 'signup',
    })
  })

  it('event sans whitelist → props vides', () => {
    expect(sanitizeProps('signup_started', { anything: 'x' })).toEqual({})
  })

  it('rejette les valeurs non-string et les payloads non-objets', () => {
    expect(sanitizeProps('calendar_opened', { surface: 42, src: ['push'] })).toEqual({})
    expect(sanitizeProps('calendar_opened', 'string')).toEqual({})
    expect(sanitizeProps('calendar_opened', null)).toEqual({})
  })

  it('tronque : q à 80, le reste à 120', () => {
    const long = 'x'.repeat(300)
    expect(sanitizeProps('search_no_results', { q: long }).q).toHaveLength(80)
    expect(sanitizeProps('notification_opened', { path: long }).path).toHaveLength(120)
  })
})
