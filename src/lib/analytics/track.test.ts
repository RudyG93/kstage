import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock du client service-role : on capture les inserts et on pilote l'erreur.
const insertMock = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ insert: insertMock }) }),
}))

import { trackEvent, dayKeyFor } from './track'

const NOW = new Date('2026-07-16T10:00:00Z')

describe('dayKeyFor', () => {
  it("politique 'once' → clé 'once'", () => {
    expect(dayKeyFor('signup_completed', NOW)).toBe('once')
  })
  it("politique 'daily' → date UTC du jour", () => {
    expect(dayKeyFor('calendar_opened', NOW)).toBe('2026-07-16')
  })
  it('sans politique → null (pas de dédup)', () => {
    expect(dayKeyFor('search_no_results', NOW)).toBeNull()
  })
})

describe('trackEvent', () => {
  // Accolades OBLIGATOIRES : mockReset() retourne le mock (chaînable), et un
  // hook vitest qui retourne une FONCTION l'exécute en teardown après le test
  // — le mock serait rappelé avec l'implémentation du test (throw → échec).
  beforeEach(() => {
    insertMock.mockReset()
  })

  it('insert la row avec le day_key de la politique', async () => {
    insertMock.mockResolvedValue({ error: null })
    await trackEvent('calendar_opened', {
      userId: 'u1',
      props: { surface: 'home' },
      now: NOW,
    })
    expect(insertMock).toHaveBeenCalledWith({
      event: 'calendar_opened',
      user_id: 'u1',
      anon_id: null,
      day_key: '2026-07-16',
      props: { surface: 'home' },
    })
  })

  it('23505 (dédup unique) → avalé sans log d’erreur', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(trackEvent('signup_completed', { userId: 'u1' })).resolves.toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('autre erreur DB → loguée mais JAMAIS de throw', async () => {
    insertMock.mockResolvedValue({ error: { code: '42P01', message: 'missing table' } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(trackEvent('calendar_opened', { userId: 'u1' })).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('insert qui throw → avalé', async () => {
    // Throw synchrone : même garantie (trackEvent ne propage jamais) sans
    // promise rejetée orpheline que le tracking interne de vi.fn signalerait
    // en « unhandled rejection ».
    insertMock.mockImplementation(() => {
      throw new Error('network down')
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(trackEvent('calendar_opened', { userId: 'u1' })).resolves.toBeUndefined()
    spy.mockRestore()
  })
})
