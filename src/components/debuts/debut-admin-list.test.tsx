// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/debuts/actions', () => ({
  approveDebutCandidate: vi.fn(),
  dismissDebutCandidate: vi.fn(),
}))

import { DebutAdminList } from './debut-admin-list'
import type { DebutCandidateRow } from '@/lib/debuts/actions'

const base = {
  detected_at: '2026-07-15T10:00:00Z',
  group_confidence: null,
}

describe('DebutAdminList', () => {
  it('une row auto-dismissed au payload {reason} ne crashe plus la page (bug BOYNEXTDOOR 2026-07-17)', () => {
    const rows: DebutCandidateRow[] = [
      {
        ...base,
        id: 'r1',
        page_title: 'BOYNEXTDOOR',
        status: 'dismissed',
        payload: { reason: 'already-in-db' },
      },
    ]
    render(<DebutAdminList items={rows} />)
    expect(screen.getByText('BOYNEXTDOOR')).toBeInTheDocument()
    expect(screen.getByText(/auto-dismissed: already-in-db/)).toBeInTheDocument()
  })

  it('une row pending complète rend nom, membres et boutons de décision', () => {
    const rows: DebutCandidateRow[] = [
      {
        ...base,
        id: 'r2',
        page_title: 'TRENDZ (page)',
        status: 'pending',
        payload: {
          name: 'TRENDZ',
          members: ['Havit', 'Leon'],
          fandomUrl: 'https://kpop.fandom.com/wiki/TRENDZ',
        } as DebutCandidateRow['payload'],
      },
    ]
    render(<DebutAdminList items={rows} />)
    expect(screen.getByText('TRENDZ')).toBeInTheDocument()
    expect(screen.getByText(/Members: Havit, Leon/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('payload complet sans members (défensif) ne crashe pas', () => {
    const rows: DebutCandidateRow[] = [
      {
        ...base,
        id: 'r3',
        page_title: 'X',
        status: 'pending',
        payload: {
          name: 'X',
          fandomUrl: 'https://kpop.fandom.com/wiki/X',
        } as DebutCandidateRow['payload'],
      },
    ]
    render(<DebutAdminList items={rows} />)
    expect(screen.getByText('X')).toBeInTheDocument()
    expect(screen.queryByText(/Members:/)).not.toBeInTheDocument()
  })
})
