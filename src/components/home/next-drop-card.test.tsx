// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// NotifyCta importe la server action (next/headers) — mock pour rester en jsdom.
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

  it('renders the title and a 4-cell countdown (D / H / M / S)', () => {
    render(<NextDropCard event={makeEvent()} isAuthed />)
    expect(screen.getByText('Whiplash')).toBeInTheDocument()
    for (const label of ['D', 'H', 'M', 'S']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('shows a D-day tag and the section label', () => {
    render(<NextDropCard event={makeEvent()} isAuthed />)
    expect(screen.getByText(/^D-/)).toBeInTheDocument()
    expect(screen.getByText(/next up — your groups/i)).toBeInTheDocument()
  })

  it('shows a truthful follow CTA when the event has a group', () => {
    render(<NextDropCard event={makeEvent()} isAuthed isFollowing={false} />)
    const follow = screen.getByRole('button', { name: 'Follow' })
    expect(follow).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText(/notify/i)).not.toBeInTheDocument()
  })

  it('shows a pressed Following button instead of a notification-settings link', () => {
    render(<NextDropCard event={makeEvent()} isAuthed isFollowing />)
    const following = screen.getByRole('button', { name: 'Following' })
    expect(following).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('link', { name: /notify/i })).not.toBeInTheDocument()
  })

  it('falls back to "?" when the group is missing', () => {
    render(<NextDropCard event={makeEvent({ groups: null, group_id: null })} />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
