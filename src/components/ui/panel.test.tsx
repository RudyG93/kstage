// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PanelHeader } from './panel'

// A11y §8.6 : les headers de panel sont de VRAIS headings (navigation par
// sections au lecteur d'écran), aspect inchangé (classes .label-data).
describe('PanelHeader', () => {
  it('rend un h2 par défaut', () => {
    render(<PanelHeader label="Upcoming queue" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Upcoming queue' })).toBeInTheDocument()
  })

  it("respecte as='h3'", () => {
    render(<PanelHeader label="Sub section" as="h3" />)
    expect(screen.getByRole('heading', { level: 3, name: 'Sub section' })).toBeInTheDocument()
  })

  it('la note de repli global est portée par le heading', () => {
    render(<PanelHeader label="This week" note="All groups" />)
    const heading = screen.getByRole('heading', { level: 2, name: /This week/ })
    expect(heading).toHaveTextContent('All groups')
  })
})
