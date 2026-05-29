import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseMbcMusicCore } from './mbc-music-core'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = readFileSync(
  join(__dirname, '__fixtures__', 'mbc-music-core-2026-05-29.txt'),
  'utf8',
)

describe('parseMbcMusicCore (fixture 2026-05-29)', () => {
  const parsed = parseMbcMusicCore(FIXTURE)

  it('renvoie un résultat non-null', () => {
    expect(parsed).not.toBeNull()
  })

  it("extrait l'épisode 948 et la date 2026-05-30", () => {
    expect(parsed?.episodeNumber).toBe(948)
    expect(parsed?.broadcastDate).toEqual({ year: 2026, month: 5, day: 30 })
  })

  it('extrait au moins 18 artistes', () => {
    expect((parsed?.artistsRaw.length ?? 0) >= 18).toBe(true)
  })

  it('contient aespa, ITZY, LE SSERAFIM, ZEROBASEONE', () => {
    expect(parsed?.artistsRaw).toContain('aespa')
    expect(parsed?.artistsRaw).toContain('ITZY')
    expect(parsed?.artistsRaw).toContain('LE SSERAFIM')
    expect(parsed?.artistsRaw).toContain('ZEROBASEONE')
  })

  it('inclut les noms coréens (하지원, 윤산하)', () => {
    expect(parsed?.artistsRaw).toContain('하지원')
  })
})

describe('parseMbcMusicCore — input vide', () => {
  it('renvoie null sur markdown vide', () => {
    expect(parseMbcMusicCore('')).toBeNull()
  })
})
