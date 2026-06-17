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
  it('renders the month title', () => {
    render(<CalendarMonth year={2026} month={6} events={[]} />)
    expect(screen.getByRole('heading', { name: 'June 2026' })).toBeInTheDocument()
  })

  it('shows a day’s events when that day is selected, mapped by KST day', async () => {
    render(<CalendarMonth year={2026} month={6} events={[makeEvent()]} />)
    // 09:00Z → 18:00 KST le 17 → la cellule du 17 porte 1 event.
    await userEvent.click(screen.getByLabelText(/June 2026 17, 1 event/))
    expect(screen.getByText('Whiplash')).toBeInTheDocument()
  })

  it('shows the empty message for a day without events', async () => {
    render(<CalendarMonth year={2026} month={6} events={[makeEvent()]} />)
    await userEvent.click(screen.getByLabelText(/June 2026 2, 0 events/))
    expect(screen.getByText('No events this day.')).toBeInTheDocument()
  })
})
