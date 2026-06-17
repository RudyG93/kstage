// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Feed } from './feed'
import type { UpcomingEvent } from '@/lib/events/queries'

function makeEvent(overrides: Partial<UpcomingEvent> = {}): UpcomingEvent {
  return {
    id: 'e1',
    slug: 'aespa-whiplash-mv',
    title: 'Whiplash',
    type: 'mv',
    start_at: new Date(Date.now() + 10 * 86_400_000).toISOString(), // ~10j → bucket "later" (dans la fenêtre 1 mois)
    status: 'confirmed',
    episode_number: null,
    source_url: null,
    groups: {
      slug: 'aespa',
      name: 'aespa',
      color_hex: '#5b5bf0',
      image_url: null,
      image_landscape: null,
      banner_url: null,
    },
    ...overrides,
  } as unknown as UpcomingEvent
}

describe('Feed', () => {
  it('shows the actionable empty state when there are no events', () => {
    render(<Feed events={[]} timeZone="Asia/Seoul" />)
    expect(screen.getByText('Your feed is quiet right now')).toBeInTheDocument()
  })

  it('renders day labels in plain case, not uppercase mono (mockup fidelity)', () => {
    render(<Feed events={[makeEvent()]} timeZone="Asia/Seoul" />)
    // Le libellé doit être « Wed · Jan 1 » (mois en Title-case), pas « WED · JAN 1 ».
    expect(screen.getByText(/·\s[A-Z][a-z]{2}\s\d/)).toBeInTheDocument()
    expect(screen.queryByText(/·\s[A-Z]{3}\s\d/)).not.toBeInTheDocument()
  })
})
