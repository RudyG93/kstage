import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseBoardLatestPost } from './sbs-board'
import { parseTheShowPostLineup } from './sbs-the-show'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BOARD = readFileSync(
  join(__dirname, '__fixtures__', 'sbs-the-show-board-2026-05-29.txt'),
  'utf8',
)
const POST = readFileSync(
  join(__dirname, '__fixtures__', 'sbs-the-show-post-393-2026-05-29.txt'),
  'utf8',
)

describe('parseBoardLatestPost (The Show board 2026-05-29, fixture stale = hiatus)', () => {
  const meta = parseBoardLatestPost(BOARD)

  it('renvoie la 1ʳᵉ row non-pub non-notice', () => {
    expect(meta).not.toBeNull()
  })

  it("extrait l'épisode 393 et la date de broadcast 11月11日", () => {
    expect(meta?.episodeNumber).toBe(393)
    expect(meta?.monthDay).toEqual({ month: 11, day: 11 })
  })

  it('extrait la post URL board_no=112519', () => {
    expect(meta?.postUrl).toContain('board_no=112519')
  })

  it("extrait l'année du post 2025", () => {
    expect(meta?.postYear).toBe(2025)
  })
})

describe('parseTheShowPostLineup (post Ep 393 du 2025-11-11)', () => {
  const artists = parseTheShowPostLineup(POST)

  it('extrait au moins 15 artistes (multi-sections Comeback/Debut/Hot)', () => {
    expect(artists.length).toBeGreaterThanOrEqual(15)
  })

  it('contient XLOV (Comeback Stage)', () => {
    expect(artists.some((a) => a.includes('XLOV'))).toBe(true)
  })

  it('contient AM8IC (Hot Debut Stage)', () => {
    expect(artists.some((a) => a.includes('AM8IC'))).toBe(true)
  })

  it('contient xikers et 82MAJOR (Hot Stage)', () => {
    expect(artists.some((a) => a.includes('xikers'))).toBe(true)
    expect(artists.some((a) => a.includes('82MAJOR'))).toBe(true)
  })

  it('ne capture pas les en-têtes "The Show ... Stage"', () => {
    expect(artists.every((a) => !/Stage\s*$/i.test(a))).toBe(true)
  })
})

describe('parseTheShowPostLineup — markdown sans Stage section', () => {
  it('renvoie []', () => {
    expect(parseTheShowPostLineup('no stage marker here')).toEqual([])
  })
})
