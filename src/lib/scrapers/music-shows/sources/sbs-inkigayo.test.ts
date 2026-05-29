import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseBoardLatestPost } from './sbs-board'
import { parseInkigayoPostLineup } from './sbs-inkigayo'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BOARD = readFileSync(
  join(__dirname, '__fixtures__', 'sbs-inkigayo-board-2026-05-29.txt'),
  'utf8',
)
const POST = readFileSync(
  join(__dirname, '__fixtures__', 'sbs-inkigayo-post-1312-2026-05-29.txt'),
  'utf8',
)

describe('parseBoardLatestPost (Inkigayo board 2026-05-29)', () => {
  const meta = parseBoardLatestPost(BOARD)

  it('renvoie la 1ʳᵉ row non-pub non-notice', () => {
    expect(meta).not.toBeNull()
  })

  it("extrait l'épisode 1312 et la date de broadcast 5月31日", () => {
    expect(meta?.episodeNumber).toBe(1312)
    expect(meta?.monthDay).toEqual({ month: 5, day: 31 })
  })

  it('extrait la post URL board_no=151356', () => {
    expect(meta?.postUrl).toContain('board_no=151356')
  })

  it('extrait le postYear 2026 depuis YY-MM-DD', () => {
    expect(meta?.postYear).toBe(2026)
    expect(meta?.postedYmd).toEqual({ year: 2026, month: 5, day: 29 })
  })
})

describe('parseInkigayoPostLineup (post Ep 1312 2026-05-29)', () => {
  const artists = parseInkigayoPostLineup(POST)

  it('extrait 19 artistes', () => {
    expect(artists.length).toBe(19)
  })

  it('contient aespa, ILLIT, ITZY, LE SSERAFIM', () => {
    expect(artists).toContain('aespa')
    expect(artists.some((a) => a.includes('ILLIT'))).toBe(true)
    expect(artists).toContain('ITZY')
    expect(artists).toContain('LE SSERAFIM')
  })

  it("contient l'artiste sur la 2ᵉ ligne (FLARE U sur la dernière)", () => {
    expect(artists.some((a) => a.includes('FLARE U'))).toBe(true)
  })

  it('strip le disclaimer "출연자는 사정상 변동…"', () => {
    expect(artists.every((a) => !a.includes('출연자는'))).toBe(true)
  })
})

describe('parseInkigayoPostLineup — markdown sans marker', () => {
  it('renvoie []', () => {
    expect(parseInkigayoPostLineup('no marker here')).toEqual([])
  })
})
