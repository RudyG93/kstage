// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { HomeEventCard } from './event-card'
import type { UpcomingEvent } from '@/lib/events/queries'

function makeEvent(overrides: Partial<UpcomingEvent> = {}): UpcomingEvent {
  return {
    id: 'e1',
    slug: 'aespa-whiplash-mv',
    title: 'Whiplash',
    type: 'mv',
    start_at: '2026-03-24T09:00:00Z', // 18:00 KST
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

describe('HomeEventCard', () => {
  it('marks external events: opens in a new tab + sr-only hint', () => {
    render(
      <HomeEventCard
        event={makeEvent({ type: 'music_show', slug: null, source_url: 'https://kbs.example/mb' })}
      />,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByText('opens an external site')).toBeInTheDocument()
  })

  it('shows "All day" for anniversaries instead of a KST time', () => {
    render(<HomeEventCard event={makeEvent({ type: 'anniversary', slug: null })} />)
    expect(screen.getByText('All day')).toBeInTheDocument()
  })

  it('shows the 24h KST time and stays internal for an MV with a slug', () => {
    render(<HomeEventCard event={makeEvent({ type: 'mv', slug: 'aespa-whiplash-mv' })} />)
    expect(screen.getByText('18:00')).toBeInTheDocument()
    expect(screen.getByRole('link')).not.toHaveAttribute('target')
  })
})
