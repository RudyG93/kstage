// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

// CalendarMonth lit l'URL (mois/jour) via next/navigation — mock léger.
vi.mock('next/navigation', () => ({
  usePathname: () => '/calendar',
  useSearchParams: () => new URLSearchParams(),
}))

import { CalendarMonth } from './calendar-month'
import type { UpcomingEvent } from '@/lib/events/queries'

function makeEvent(overrides: Partial<UpcomingEvent> = {}): UpcomingEvent {
  return {
    id: 'a',
    slug: 'aespa-whiplash-mv',
    title: 'Whiplash',
    type: 'mv',
    start_at: '2026-06-17T09:00:00Z', // 18:00 KST, 17 juin
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

describe('CalendarMonth', () => {
  it('renders the page heading and the month pager', () => {
    render(<CalendarMonth year={2026} month={6} events={[]} timeZone="Asia/Seoul" />)
    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument()
    expect(screen.getByText('JUN 2026')).toBeInTheDocument()
  })

  it('maps events to their KST day cell and lists them below the grid', async () => {
    render(<CalendarMonth year={2026} month={6} events={[makeEvent()]} timeZone="Asia/Seoul" />)
    // 09:00Z → 18:00 KST le 17 → la cellule du 17 porte 1 event.
    expect(screen.getByLabelText(/JUN 17, 1 event/)).toBeInTheDocument()
    // La liste par jour sous la grille montre l'event (sans clic).
    expect(screen.getByText(/Whiplash/)).toBeInTheDocument()
  })

  it('shows the empty message when selecting a day without events', async () => {
    render(<CalendarMonth year={2026} month={6} events={[makeEvent()]} timeZone="Asia/Seoul" />)
    await userEvent.click(screen.getByLabelText(/JUN 2, 0 events/))
    expect(screen.getByText('No events this day.')).toBeInTheDocument()
  })

  it('garde un anniversaire sur sa date civile en vue Paris (pas de glissement à J-1)', () => {
    // Anniversaire du 17 juin, ancré minuit KST = 16 juin 15:00Z. Sans la
    // sémantique date-pure, la vue Europe/Paris le rangeait dans la cellule
    // du 16 (bug du 2026-07-17 : Wonwoo affiché la veille).
    const bday = makeEvent({
      id: 'anniv-1',
      type: 'anniversary',
      title: 'Wonwoo — 30',
      start_at: '2026-06-16T15:00:00Z',
    })
    render(<CalendarMonth year={2026} month={6} events={[bday]} timeZone="Europe/Paris" />)
    expect(screen.getByLabelText(/JUN 17, 1 event/)).toBeInTheDocument()
    expect(screen.getByLabelText(/JUN 16, 0 events/)).toBeInTheDocument()
  })

  it('lit un event à heure réelle dans le fuseau du viewer (00:30 KST = la veille au soir à Paris)', () => {
    // 15:30Z le 17 = 00:30 KST le 18, mais 17:30 le 17 à Paris.
    const show = makeEvent({ id: 'show-1', start_at: '2026-06-17T15:30:00Z' })
    render(<CalendarMonth year={2026} month={6} events={[show]} timeZone="Europe/Paris" />)
    expect(screen.getByLabelText(/JUN 17, 1 event/)).toBeInTheDocument()
    expect(screen.getByLabelText(/JUN 18, 0 events/)).toBeInTheDocument()
  })
})
