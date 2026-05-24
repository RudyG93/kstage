import { describe, it, expect } from 'vitest'
import { formatEventDate } from './queries'

describe('formatEventDate', () => {
  it('formats a UTC instant in the given timezone', () => {
    const result = formatEventDate('2026-06-15T09:00:00Z', 'Asia/Seoul')
    expect(result).toMatch(/Jun.*15.*2026/)
  })

  it('shifts the local day according to the timezone', () => {
    // 23:00 UTC le 15 → déjà le 16 à Séoul (UTC+9).
    const seoul = formatEventDate('2026-06-15T23:00:00Z', 'Asia/Seoul')
    expect(seoul).toMatch(/Jun.*16.*2026/)
  })
})
