// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Ticker } from './ticker'
import type { TickerItem } from '@/lib/events/ticker'

const items: TickerItem[] = [
  { text: 'AESPA — MV · TODAY', color: '#0aa', live: false },
  { text: 'IVE — RELEASE · JUL 18', color: '#a0a', live: false },
  { text: 'M COUNTDOWN · JUL 17', color: '#aa0', live: false },
]

// A11y §8.6 : la séquence est répétée pour couvrir le marquee — un lecteur
// d'écran entendait chaque annonce jusqu'à 8 fois. Seule la 1ʳᵉ séquence de la
// 1ʳᵉ rangée est exposée ; répétitions et rangée-miroir sont aria-hidden.
describe('Ticker', () => {
  // Les spans FEUILLE du texte (.label-data) — le wrapper parent porte le même
  // textContent et compterait double.
  const textSpans = (root: HTMLElement, text: string) =>
    [...root.querySelectorAll('span.label-data')].filter((el) => el.textContent === text)

  it('chaque annonce n’est exposée qu’UNE fois aux lecteurs d’écran', () => {
    const { container } = render(<Ticker items={items} />)
    const occurrences = textSpans(container, items[0].text)
    expect(occurrences.length).toBeGreaterThan(1) // le marquee répète bien
    const exposed = occurrences.filter((el) => !el.closest('[aria-hidden="true"]'))
    expect(exposed).toHaveLength(1)
  })

  it('< 3 items → statique, une seule occurrence, rien de masqué', () => {
    const two = items.slice(0, 2)
    const { container } = render(<Ticker items={two} />)
    const occurrences = textSpans(container, two[0].text)
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0].closest('[aria-hidden="true"]')).toBeNull()
  })
})
