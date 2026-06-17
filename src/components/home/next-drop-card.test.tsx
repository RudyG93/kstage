// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// FollowButton importe la server action (next/headers) — mock pour rester en jsdom.
vi.mock('@/lib/follows/actions', () => ({ toggleFollow: vi.fn() }))

import { NextDropCard } from './next-drop-card'
import type { UpcomingEvent } from '@/lib/events/queries'

function makeEvent(overrides: Record<string, unknown> = {}): UpcomingEvent {
  return {
    id: 'e1',
    group_id: 'g1',
    slug: 'aespa-whiplash-mv',
    title: 'Whiplash',
    type: 'mv',
    start_at: '2099-01-01T09:00:00Z',
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

describe('NextDropCard', () => {
  it('renders nothing when there is no upcoming event', () => {
    const { container } = render(<NextDropCard event={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the title and a 3-unit countdown (days / hrs / min)', () => {
    render(<NextDropCard event={makeEvent()} isAuthed />)
    expect(screen.getByText('Whiplash')).toBeInTheDocument()
    expect(screen.getByText('days')).toBeInTheDocument()
    expect(screen.getByText('hrs')).toBeInTheDocument()
    expect(screen.getByText('min')).toBeInTheDocument()
  })

  it('shows a follow control when the event has a group + authed viewer', () => {
    render(<NextDropCard event={makeEvent()} isAuthed isFollowing={false} />)
    expect(screen.getByRole('button', { name: /follow/i })).toBeInTheDocument()
  })

  it('falls back to "?" when the group is missing', () => {
    render(<NextDropCard event={makeEvent({ groups: null, group_id: null })} />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
