import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AuthMenu } from './auth-menu'

// Régression §9.2 : l'avatar (ici les initiales) doit être rendu dans le trigger
// du menu compte quand l'user est connecté. Vérifie le câblage Base UI `render`.
describe('AuthMenu (logged in)', () => {
  it('renders the avatar initials in the account trigger', () => {
    render(<AuthMenu email="rudy@example.com" username="Remilio" avatarUrl={null} />)
    expect(screen.getByText('RE')).toBeInTheDocument()
  })

  it('renders login/signup when logged out', () => {
    render(<AuthMenu email={null} />)
    expect(screen.getByText('Log in')).toBeInTheDocument()
  })
})
