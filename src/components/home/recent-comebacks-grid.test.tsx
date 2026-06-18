// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RecentComebacksGrid } from './recent-comebacks-grid'
import type { MvEvent } from '@/lib/events/queries'

function makeMv(id: string, name: string): MvEvent {
  return {
    id,
    slug: `${id}-mv`,
    title: `${name} 'Song' MV`,
    type: 'mv',
    start_at: '2026-05-01T09:00:00Z',
    source_url: 'https://www.youtube.com/watch?v=abc',
    image_url: null,
    groups: { slug: name.toLowerCase(), name, color_hex: '#fff', image_url: null },
  } as unknown as MvEvent
}

const ratings = new Map()

describe('RecentComebacksGrid', () => {
  it('shows "From your groups" + "Recent comebacks" when the user follows groups', () => {
    render(
      <RecentComebacksGrid
        fromYourGroups={[makeMv('a', 'aespa')]}
        recent={[makeMv('b', 'IVE')]}
        ratings={ratings}
        hasFollows
      />,
    )
    expect(screen.getByText('From your groups')).toBeInTheDocument()
    expect(screen.getByText('Recent comebacks')).toBeInTheDocument()
    expect(screen.queryByText('Browse groups')).not.toBeInTheDocument()
  })

  it('shows a follow CTA (no "From your groups") for a user with no follows', () => {
    render(
      <RecentComebacksGrid
        fromYourGroups={[]}
        recent={[makeMv('b', 'IVE')]}
        ratings={ratings}
        hasFollows={false}
      />,
    )
    expect(screen.queryByText('From your groups')).not.toBeInTheDocument()
    expect(screen.getByText('Browse groups')).toBeInTheDocument()
    // la grille globale « Recent comebacks » reste affichée (découverte).
    expect(screen.getByText('Recent comebacks')).toBeInTheDocument()
  })
})
