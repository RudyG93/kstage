import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseComebacks, matchGroup, matchGroups, type GroupRef } from './kpopofficial'

const GROUPS: GroupRef[] = [
  { id: 'g-aespa', slug: 'aespa', name: 'aespa' },
  { id: 'g-illit', slug: 'illit', name: 'ILLIT' },
  { id: 'g-bm', slug: 'babymonster', name: 'BABYMONSTER' },
  { id: 'g-idle', slug: 'idle', name: 'i-dle' },
]

// Item calqué sur la vraie structure Greenshift de kpopofficial.
function item(opts: {
  title: string
  href: string
  artist: string
  date: string
  img?: string
}): string {
  return `
    <li class="gspbgrid_item swiper-slide type-album">
      <a class="gspbgrid_item_link" title="${opts.title}" href="${opts.href}"></a>
      <div class="gspb_container">
        <div class="gspb_meta"><span class="gspb_meta_value">MAY</span></div>
        <div class="gspb_meta"><span class="gspb_meta_value">4</span></div>
      </div>
      <div class="gspb_container">
        <div class="gspb_meta"><a href="${opts.href}"><span class="gspb_meta_value">${opts.artist}</span></a></div>
        <div class="gspb_meta"><a href="${opts.href}"><span class="gspb_meta_value">${opts.date}</span></a></div>
        <div class="gspb_meta"><span class="gspb_meta_value">Title – "Track"</span></div>
        <div class="gspb_meta"><span class="gspb_meta_value">3rd Mini Album – Album Name</span></div>
      </div>
      <img data-orig-file="${opts.img ?? 'https://kpopofficial.com/img/cover.webp'}" src="placeholder.webp" />
    </li>`
}

const HTML = `<html><body><ul class="gspbgrid">
  ${item({ title: 'BABYMONSTER 3rd Mini Album – CHOOM (2026)', href: 'https://kpopofficial.com/album/babymonster-choom/', artist: 'BABYMONSTER', date: 'May 4 (Mon) · 6 PM KST' })}
  ${item({ title: 'aespa 2nd Album – LEMONADE (2026)', href: 'https://kpopofficial.com/album/aespa-lemonade/', artist: 'aespa', date: 'May 29 (Fri) · 1 PM KST' })}
  ${item({ title: '(G)I-DLE 9th Mini Album – I SWAY (2026)', href: 'https://kpopofficial.com/album/idle-i-sway/', artist: '(G)I-DLE', date: 'July 21 (Tue) · TBC' })}
  ${item({ title: 'Krystal Single – PWLT (2026)', href: 'https://kpopofficial.com/album/krystal-pwlt/', artist: 'Krystal', date: 'May 26 (Tue) · 6 PM KST' })}
  ${item({ title: 'BABYMONSTER duplicate (2026)', href: 'https://kpopofficial.com/album/babymonster-choom/', artist: 'BABYMONSTER', date: 'May 4 (Mon) · 6 PM KST' })}
</ul></body></html>`

describe('parseComebacks', () => {
  const parsed = parseComebacks(HTML, 2026)

  it('dédoublonne par source_url (clone Swiper / doublon)', () => {
    expect(parsed).toHaveLength(4)
  })

  it('extrait titre, permalink, image', () => {
    const bm = parsed.find((p) => p.artist === 'BABYMONSTER')!
    expect(bm.title).toBe('BABYMONSTER 3rd Mini Album – CHOOM (2026)')
    expect(bm.sourceUrl).toBe('https://kpopofficial.com/album/babymonster-choom/')
    expect(bm.imageUrl).toBe('https://kpopofficial.com/img/cover.webp')
  })

  it('convertit l’heure KST en UTC (6 PM KST = 09:00 UTC)', () => {
    const bm = parsed.find((p) => p.artist === 'BABYMONSTER')!
    expect(bm.startAt).toBe('2026-05-04T09:00:00.000Z')
    expect(bm.status).toBe('confirmed')
  })

  it('gère 1 PM KST (= 04:00 UTC)', () => {
    const aespa = parsed.find((p) => p.artist === 'aespa')!
    expect(aespa.startAt).toBe('2026-05-29T04:00:00.000Z')
  })

  it('marque tentative quand l’heure est absente (TBC)', () => {
    const idle = parsed.find((p) => p.artist === '(G)I-DLE')!
    expect(idle.status).toBe('tentative')
    // minuit KST 21 juillet = 20 juillet 15:00 UTC
    expect(idle.startAt).toBe('2026-07-20T15:00:00.000Z')
  })
})

describe('matchGroup', () => {
  it('matche nos groupes (casse/espaces ignorés)', () => {
    expect(matchGroup('BABYMONSTER', GROUPS)?.slug).toBe('babymonster')
    expect(matchGroup('aespa', GROUPS)?.slug).toBe('aespa')
    expect(matchGroup('ILLIT', GROUPS)?.slug).toBe('illit')
  })

  it('matche les variantes de (G)I-DLE', () => {
    expect(matchGroup('(G)I-DLE', GROUPS)?.slug).toBe('idle')
    expect(matchGroup('GIDLE', GROUPS)?.slug).toBe('idle')
    expect(matchGroup('G-IDLE', GROUPS)?.slug).toBe('idle')
    expect(matchGroup('I-DLE', GROUPS)?.slug).toBe('idle')
  })

  it('retourne null pour un groupe non suivi', () => {
    expect(matchGroup('Krystal', GROUPS)).toBeNull()
    expect(matchGroup('NewJeans', GROUPS)).toBeNull()
  })
})

// Matching élargi P0.5 — cas RÉELS relevés sur le calendrier kpopofficial
// juin/juillet 2026 (diagnostic 2026-06-13) : 35 artistes non matchés dont
// 3 patterns récupérables pour des groupes déjà en DB.
describe('matchGroups', () => {
  const EXTENDED: GroupRef[] = [
    ...GROUPS,
    { id: 'g-skz', slug: 'straykids', name: 'Stray Kids' },
    { id: 'g-lsf', slug: 'lesserafim', name: 'Le Sserafim' },
    { id: 'g-ateez', slug: 'ateez', name: 'ATEEZ' },
    { id: 'g-dc', slug: 'dreamcatcher', name: 'Dreamcatcher' },
  ]

  it('match direct inchangé (passe par matchGroup)', () => {
    expect(matchGroups('aespa', EXTENDED).map((g) => g.slug)).toEqual(['aespa'])
    expect(matchGroups('(G)I-DLE', EXTENDED).map((g) => g.slug)).toEqual(['idle'])
  })

  it("suffixe d'édition : « aespa (JP) » / « ATEEZ (JP) » → le groupe", () => {
    expect(matchGroups('aespa (JP)', EXTENDED).map((g) => g.slug)).toEqual(['aespa'])
    expect(matchGroups('ATEEZ (JP)', EXTENDED).map((g) => g.slug)).toEqual(['ateez'])
  })

  it('collab « LE SSERAFIM x ILLIT x KATSEYE » → un event par groupe en DB', () => {
    expect(matchGroups('LE SSERAFIM x ILLIT x KATSEYE', EXTENDED).map((g) => g.slug)).toEqual([
      'lesserafim',
      'illit',
    ])
  })

  it('solo de membre « HAN (Stray Kids) » → rattaché au groupe parent', () => {
    expect(matchGroups('HAN (Stray Kids)', EXTENDED).map((g) => g.slug)).toEqual(['straykids'])
    expect(matchGroups('UAU (Dreamcatcher)', EXTENDED).map((g) => g.slug)).toEqual(['dreamcatcher'])
  })

  it('parent inconnu ou bruit → aucun match (comportement inchangé)', () => {
    expect(matchGroups('JAY B (GOT7)', EXTENDED)).toEqual([])
    expect(matchGroups('MiiWAN (Virtual)', EXTENDED)).toEqual([])
    expect(matchGroups('XODIAC', EXTENDED)).toEqual([])
    expect(matchGroups('June 12–13, 2026', EXTENDED)).toEqual([])
  })
})

// Canari de dérive du DOM Greenshift : capture RÉELLE datée (2026-06-16) de
// kpopofficial.com. Elle a révélé que l'artiste avait migré du `gspb_meta_value`
// vers `.gspb-dynamic-title-element` : sur ces items (tout le carrousel ici),
// l'ancien parsing meta renvoyait 0 → couverture dégradée en prod (la grille
// classique passait encore, ~10 matches/run, d'où une panne non totale mais une
// perte silencieuse des items carrousel + éditions JP). Le fixture synthétique
// ci-dessus ne couvre désormais plus que le chemin de fallback legacy.
describe('parseComebacks — fixture réelle (canari DOM Greenshift)', () => {
  const html = readFileSync(
    new URL('./__fixtures__/kpopofficial-june-2026.html', import.meta.url),
    'utf8',
  )
  const parsed = parseComebacks(html, 2026)

  it('extrait les 12 comebacks réels (artiste depuis le titre dynamique)', () => {
    expect(parsed).toHaveLength(12)
    for (const p of parsed) {
      expect(p.artist.length).toBeGreaterThan(0)
      expect(p.sourceUrl).toMatch(/^https:\/\/kpopofficial\.com\/album\//)
      expect(p.startAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    }
  })

  it('parse un item confirmé (STAYC — 2:LOVE, 6 PM KST = 09:00 UTC)', () => {
    const stayc = parsed.find((p) => p.artist === 'STAYC')!
    expect(stayc.sourceUrl).toBe('https://kpopofficial.com/album/stayc-2-love/')
    expect(stayc.startAt).toBe('2026-06-16T09:00:00.000Z')
    expect(stayc.status).toBe('confirmed')
  })

  it('gère minuit KST (12 AM KST = jour précédent 15:00 UTC) — OMEGA X', () => {
    const omega = parsed.find((p) => p.artist.startsWith('OMEGA'))!
    expect(omega.startAt).toBe('2026-06-18T15:00:00.000Z')
  })
})
