// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NextDropCard } from './next-drop-card'
import type { UpcomingEvent } from '@/lib/events/queries'

// Override large : le composant garde `group?.name` (groups peut être null au
// runtime même si le type !inner le déclare non-null) → on teste ce fallback.
function makeEvent(overrides: Record<string, unknown> = {}): UpcomingEvent {
  return {
    id: 'e1',
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

  it('uses a type-aware countdown label (music show → "until show", not "until release")', () => {
    render(
      <NextDropCard
        event={makeEvent({ type: 'music_show', slug: null, source_url: 'https://kbs.example/mb' })}
      />,
    )
    expect(screen.getByText('until show')).toBeInTheDocument()
    expect(screen.queryByText('until release')).not.toBeInTheDocument()
  })

  it('falls back to "?" when the group is missing', () => {
    render(<NextDropCard event={makeEvent({ groups: null })} />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
