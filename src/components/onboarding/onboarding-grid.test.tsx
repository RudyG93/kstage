// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted : les factories de vi.mock s'exécutent pendant la phase d'import,
// avant les const du corps du module (TDZ sinon).
const { followManyMock, pushMock } = vi.hoisted(() => ({
  followManyMock: vi.fn(),
  pushMock: vi.fn(),
}))
vi.mock('@/lib/follows/actions', () => ({
  followMany: (ids: string[]) => followManyMock(ids),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))

import { OnboardingGrid } from './onboarding-grid'

// jsdom n'implémente pas matchMedia (utilisé par IosInstallHint au step
// notifications) — shim minimal non-matché.
window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

const groups = Array.from({ length: 40 }, (_, i) => ({
  id: `id-${i}`,
  name: `Group ${i}`,
  image: null,
}))

describe('OnboardingGrid', () => {
  beforeEach(() => {
    followManyMock.mockClear()
    pushMock.mockClear()
  })

  it('séquence complète : sélection → follow → notifications → done → /calendar', async () => {
    followManyMock.mockResolvedValue(undefined)
    render(<OnboardingGrid groups={groups} />)

    // Objectif visible, compteur à 0.
    expect(screen.getByText(/Pick at least 3/)).toBeInTheDocument()
    expect(screen.getByText('0/3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Group 0$/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Group 1$/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Group 2$/ }))
    expect(screen.getByText('3/3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Follow 3 & continue' }))

    // Étape notifications — en jsdom le push est `unsupported` (pas de
    // serviceWorker) → branche hint + « Continue » (jamais bloquant).
    await waitFor(() => expect(screen.getByText('Never miss a drop')).toBeInTheDocument())
    expect(followManyMock).toHaveBeenCalledWith(['id-0', 'id-1', 'id-2'])
    // RTL : un `name` string matche le nom accessible COMPLET (≠ Playwright).
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // Étape done : CTA « voir son calendrier » → /calendar.
    await waitFor(() => expect(screen.getByText('Your calendar is ready')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /See your calendar/ }))
    expect(pushMock).toHaveBeenCalledWith('/calendar')
  })

  it('la recherche filtre TOUTE la liste (au-delà du top 30 affiché)', () => {
    render(<OnboardingGrid groups={groups} />)
    // Group 35 est hors du top 30 par défaut.
    expect(screen.queryByRole('button', { name: /^Group 35$/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search groups' }), {
      target: { value: 'Group 35' },
    })
    expect(screen.getByRole('button', { name: /^Group 35$/ })).toBeInTheDocument()
  })

  it('skip → sortie home sans follow', () => {
    render(<OnboardingGrid groups={groups} />)
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(followManyMock).not.toHaveBeenCalled()
  })
})
