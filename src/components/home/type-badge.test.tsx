// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TypeBadge } from './type-badge'

describe('TypeBadge', () => {
  it('renders the human label for a known type', () => {
    render(<TypeBadge type="mv" />)
    expect(screen.getByText('MV')).toBeInTheDocument()
  })

  it('renders the music show label', () => {
    render(<TypeBadge type="music_show" />)
    expect(screen.getByText('Music Show')).toBeInTheDocument()
  })
})
