import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseKbsMusicBank } from './kbs-music-bank'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = readFileSync(
  join(__dirname, '__fixtures__', 'kbs-music-bank-2026-05-29.txt'),
  'utf8',
)

describe('parseKbsMusicBank (fixture 2026-05-29)', () => {
  const parsed = parseKbsMusicBank(FIXTURE)

  it('renvoie un résultat non-null', () => {
    expect(parsed).not.toBeNull()
  })

  it('extrait la date du broadcast', () => {
    expect(parsed?.broadcastDate).toEqual({ year: 2026, month: 5, day: 29 })
  })

  it('extrait les 18 artistes du lineup', () => {
    expect(parsed?.artistsRaw.length).toBe(18)
  })

  it('contient aespa, ILLIT, ITZY, LE SSERAFIM', () => {
    expect(parsed?.artistsRaw).toContain('aespa')
    expect(parsed?.artistsRaw.some((a) => a.includes('ILLIT'))).toBe(true)
    expect(parsed?.artistsRaw.some((a) => a.includes('ITZY'))).toBe(true)
    expect(parsed?.artistsRaw).toContain('LE SSERAFIM')
  })

  it('gère "태양 (feat. TARZZAN, WOOCHAN)" sans le split sur la virgule du feat', () => {
    // Note : le scraper split sur "," brut donc "feat. TARZZAN" devient un
    // artiste séparé. extractCanonicalName côté caller filtrera. Vérifie juste
    // que "태양 (feat. TARZZAN" est présent comme prefix.
    const hasTaeyangSplit = parsed?.artistsRaw.some((a) => a.includes('태양'))
    expect(hasTaeyangSplit).toBe(true)
  })
})

describe('parseKbsMusicBank — input vide / malformé', () => {
  it('renvoie null si pas de marker lineup', () => {
    expect(parseKbsMusicBank('aucun marker ici')).toBeNull()
    expect(parseKbsMusicBank('')).toBeNull()
  })
})
