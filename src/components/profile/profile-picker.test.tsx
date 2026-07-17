// @vitest-environment jsdom
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { ProfilePicker, type PickerItem } from './profile-picker'

// jsdom n'a pas d'IntersectionObserver — mock qui capture les callbacks pour
// simuler l'entrée de la sentinelle dans le viewport.
let ioCallbacks: IntersectionObserverCallback[] = []
beforeEach(() => {
  ioCallbacks = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionObserverCallback) {
        ioCallbacks.push(cb)
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
})

const items: PickerItem[] = Array.from({ length: 250 }, (_, i) => ({
  id: `m${i}`,
  name: `Member ${String(i).padStart(3, '0')}`,
  avatar: null,
}))

const noop = async () => ({ ok: true }) as const

function openPicker() {
  render(<ProfilePicker label="Bias" current={null} items={items} onSelect={noop} />)
  fireEvent.click(screen.getByRole('button', { name: /set bias/i }))
}

describe('ProfilePicker', () => {
  it('rend la première tranche de 100 (fini le cap dur à 60) + une sentinelle', () => {
    openPicker()
    expect(screen.getAllByText(/^Member \d+$/)).toHaveLength(100)
    // Le rang 61 (invisible avec l'ancien cap) est rendu.
    expect(screen.getByText('Member 060')).toBeInTheDocument()
  })

  it('étend la liste quand la sentinelle entre dans le viewport, jusqu’au bout', () => {
    openPicker()
    act(() => {
      ioCallbacks.at(-1)?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })
    expect(screen.getAllByText(/^Member \d+$/)).toHaveLength(200)
    act(() => {
      ioCallbacks.at(-1)?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })
    // 250 items : tout est rendu, la sentinelle disparaît.
    expect(screen.getAllByText(/^Member \d+$/)).toHaveLength(250)
  })

  it('la recherche filtre la liste COMPLÈTE (pas seulement la tranche visible)', () => {
    openPicker()
    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: '249' } })
    expect(screen.getByText('Member 249')).toBeInTheDocument()
  })
})
