import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseReleases } from './wikipedia-releases'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = readFileSync(join(here, '__fixtures__/wikipedia-2026-in-skm.txt'), 'utf8')

describe('parseReleases (Wikipedia 2026 in South Korean music, real fixture)', () => {
  const all = parseReleases(fixture, 2026)
  const byArtist = (name: string) =>
    all.filter((e) => e.artist.toLowerCase() === name.toLowerCase())

  it('extrait un volume plausible de releases (≥ 100)', () => {
    expect(all.length).toBeGreaterThan(100)
  })

  it('ignore la table Awards (pas de host/event dans les artistes)', () => {
    // « Golden Disc Awards » est un event, pas un album → ne doit pas être un artiste.
    expect(all.some((e) => /golden disc/i.test(e.artist))).toBe(false)
  })

  it('parse une ligne simple (Apink — Re: Love, January 5)', () => {
    const apink = byArtist('Apink')
    expect(apink.length).toBeGreaterThan(0)
    expect(apink[0].title).toContain('Re: Love')
    // 5 janvier 2026 minuit KST = 2026-01-04T15:00:00Z
    expect(apink[0].startAt).toBe('2026-01-04T15:00:00.000Z')
  })

  it('porte le jour via rowspan (CNBLUE — 3logy, January 7 = même jour que Shin Soo-hyun)', () => {
    const cnblue = all.find((e) => e.artist === 'CNBLUE')
    expect(cnblue).toBeTruthy()
    expect(cnblue!.startAt).toBe('2026-01-06T15:00:00.000Z') // 7 janv KST
  })

  it('résout les alias de wikilink ([[UAU (group)|UAU]] → UAU)', () => {
    expect(all.some((e) => e.artist === 'UAU')).toBe(true)
  })

  it('capte des comebacks futurs connus (ATEEZ juin, UAU juillet)', () => {
    const ateez = all.find((e) => e.artist === 'Ateez' && e.startAt.startsWith('2026-06'))
    expect(ateez).toBeTruthy()
    const uau = all.find((e) => e.artist === 'UAU' && e.startAt.startsWith('2026-06-30'))
    // UAU 1er juillet KST = 30 juin 15:00Z
    expect(uau).toBeTruthy()
  })

  it('source_url synthétique unique et pointant la page Wikipedia', () => {
    const urls = all.map((e) => e.sourceUrl)
    expect(new Set(urls).size).toBe(urls.length) // tous uniques
    expect(
      urls.every((u) => u.startsWith('https://en.wikipedia.org/wiki/2026_in_South_Korean_music#')),
    ).toBe(true)
  })

  it('toutes les entrées ont un titre, un artiste et une date ISO', () => {
    for (const e of all) {
      expect(e.title.length).toBeGreaterThan(0)
      expect(e.artist.length).toBeGreaterThan(0)
      expect(e.startAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(e.status).toBe('tentative')
    }
  })
})
