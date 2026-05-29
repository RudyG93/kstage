import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseShowChampion } from './show-champion'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = readFileSync(
  join(__dirname, '__fixtures__', 'show-champion-2026-05-29.txt'),
  'utf8',
)

describe('parseShowChampion (fixture 2026-05-29 — Ep 598)', () => {
  const parsed = parseShowChampion(FIXTURE)

  it('renvoie un résultat non-null', () => {
    expect(parsed).not.toBeNull()
  })

  it("extrait l'épisode 598 et la date 2026-05-27", () => {
    expect(parsed?.episodeNumber).toBe(598)
    expect(parsed?.broadcastDate).toEqual({ year: 2026, month: 5, day: 27 })
  })

  it('extrait 13 artistes (liste coréenne complète après 등)', () => {
    expect(parsed?.artistsRaw.length).toBe(13)
  })

  it('contient le 1ᵉʳ et le dernier de la liste', () => {
    expect(parsed?.artistsRaw[0]).toBe('알파드라이브원')
    expect(parsed?.artistsRaw.at(-1)).toBe('피원하모니')
  })

  it('split tolère les virgules sans espace (츄,피원하모니)', () => {
    expect(parsed?.artistsRaw).toContain('츄')
    expect(parsed?.artistsRaw).toContain('피원하모니')
  })

  it('ne capture pas la 2ᵉ entrée (Ep 597)', () => {
    // Doit s'arrêter au 1ᵉʳ épisode trouvé (le plus récent).
    expect(parsed?.artistsRaw).not.toContain('Billlie')
  })
})

describe('parseShowChampion — fallback headliners (pas de full list après 등)', () => {
  // Synthétique : mime le format Ep 596 du fixture (`-QWER, TWS 등 2026.05.06`).
  const synth =
    '*   [![Image](IMG) **596**회 Show Champion (쇼 챔피언) -QWER, TWS 등 2026.05.06](VOD)'

  it('retombe sur les headliners avant 등', () => {
    const parsed = parseShowChampion(synth)
    expect(parsed?.episodeNumber).toBe(596)
    expect(parsed?.broadcastDate).toEqual({ year: 2026, month: 5, day: 6 })
    expect(parsed?.artistsRaw).toEqual(['QWER', 'TWS'])
  })
})

describe('parseShowChampion — pas de 등', () => {
  // Cas Ep 595 du fixture (`- &TEAM, Xdinary Heroes 2026.04.29`, pas de 등).
  const synth =
    '*   [![Image](IMG) **595**회 Show Champion (쇼 챔피언) - &TEAM, Xdinary Heroes 2026.04.29](VOD)'

  it('split le titre entier sur virgules', () => {
    const parsed = parseShowChampion(synth)
    expect(parsed?.artistsRaw).toEqual(['&TEAM', 'Xdinary Heroes'])
  })
})

describe('parseShowChampion — input vide / hors pattern', () => {
  it('renvoie null sur markdown vide', () => {
    expect(parseShowChampion('')).toBeNull()
  })

  it('renvoie null si aucune ligne ne matche', () => {
    expect(parseShowChampion('## random heading\nfoo bar baz')).toBeNull()
  })
})
