import { describe, it, expect } from 'vitest'
import { welcomeHtml } from './resend'

// Contrat Phase 2 Lot 2 : l'email de bienvenue oriente vers LE calendrier
// (north-star), pas vers des pages génériques.
describe('welcomeHtml', () => {
  it('le CTA principal et le premier lien pointent /calendar', () => {
    const html = welcomeHtml('rudy')
    expect(html).toContain('/calendar')
    expect(html).toContain('Open your calendar')
    expect(html).toContain('Turn on notifications')
    expect(html).not.toContain('Browse upcoming events')
  })

  it('salutation avec et sans username', () => {
    expect(welcomeHtml('rudy')).toContain('Hi rudy,')
    expect(welcomeHtml(null)).toContain('Hi,')
  })
})
