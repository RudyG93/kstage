// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// FollowButton importe la server action (next/headers) — mock pour rester en jsdom.
vi.mock('@/lib/follows/actions', () => ({ toggleFollow: vi.fn() }))

import { GroupCard } from './group-card'
import type { GroupSummary } from '@/lib/groups/queries'

const group = {
  id: 'g1',
  slug: 'aespa',
  name: 'aespa',
  fandom_name: 'MY',
  debut_date: '2020-11-17',
  color_hex: '#5b5bf0',
  image_url: null,
} as unknown as GroupSummary

describe('GroupCard', () => {
  it('renders the group name', () => {
    render(<GroupCard group={group} isFollowing={false} isAuthed />)
    expect(screen.getByText('aespa')).toBeInTheDocument()
  })

  it('exposes an Unfollow control when already following', () => {
    render(<GroupCard group={group} isFollowing isAuthed />)
    expect(screen.getByLabelText('Unfollow')).toBeInTheDocument()
  })

  it('sends a logged-out visitor to /login to follow', () => {
    render(<GroupCard group={group} isFollowing={false} isAuthed={false} />)
    const follow = screen.getByLabelText('Follow')
    expect(follow).toHaveAttribute('href', '/login')
  })
})
