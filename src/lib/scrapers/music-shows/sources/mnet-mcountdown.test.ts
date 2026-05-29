import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseMnetMcountdown } from './mnet-mcountdown'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = readFileSync(
  join(__dirname, '__fixtures__', 'mnet-mcountdown-2026-05-29.txt'),
  'utf8',
)

describe('parseMnetMcountdown (fixture 2026-05-29)', () => {
  const parsed = parseMnetMcountdown(FIXTURE)

  it('renvoie un résultat non-null', () => {
    expect(parsed).not.toBeNull()
  })

  it('extrait au moins 10 artistes', () => {
    expect((parsed?.artistsRaw.length ?? 0) >= 10).toBe(true)
  })

  it('contient LE SSERAFIM + ILLIT + ITZY + ZEROBASEONE (du lineup attendu)', () => {
    expect(parsed?.artistsRaw).toContain('LE SSERAFIM')
    expect(parsed?.artistsRaw).toContain('ILLIT')
    expect(parsed?.artistsRaw).toContain('ITZY')
    expect(parsed?.artistsRaw).toContain('ZEROBASEONE')
  })

  it('ne capture pas les noms de MCs ou nav (Park Hyun Kyu est performer ; SO JUNG HWAN est MC)', () => {
    // Park Hyun Kyu est explicitement listé comme performer dans la fixture
    expect(parsed?.artistsRaw).toContain('Park Hyun Kyu')
  })
})

describe('parseMnetMcountdown — input vide', () => {
  it('renvoie null sur markdown vide', () => {
    expect(parseMnetMcountdown('')).toBeNull()
  })
})
