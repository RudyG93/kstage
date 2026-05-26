import { describe, it, expect } from 'vitest'
import { parseComebacks, matchGroup, type GroupRef } from './kpopofficial'

const GROUPS: GroupRef[] = [
  { id: 'g-aespa', slug: 'aespa', name: 'aespa' },
  { id: 'g-illit', slug: 'illit', name: 'ILLIT' },
  { id: 'g-bm', slug: 'babymonster', name: 'BABYMONSTER' },
  { id: 'g-gidle', slug: 'gidle', name: '(G)I-DLE' },
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
  ${item({ title: '(G)I-DLE 9th Mini Album – I SWAY (2026)', href: 'https://kpopofficial.com/album/gidle-i-sway/', artist: '(G)I-DLE', date: 'July 21 (Tue) · TBC' })}
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
    const gidle = parsed.find((p) => p.artist === '(G)I-DLE')!
    expect(gidle.status).toBe('tentative')
    // minuit KST 21 juillet = 20 juillet 15:00 UTC
    expect(gidle.startAt).toBe('2026-07-20T15:00:00.000Z')
  })
})

describe('matchGroup', () => {
  it('matche nos groupes (casse/espaces ignorés)', () => {
    expect(matchGroup('BABYMONSTER', GROUPS)?.slug).toBe('babymonster')
    expect(matchGroup('aespa', GROUPS)?.slug).toBe('aespa')
    expect(matchGroup('ILLIT', GROUPS)?.slug).toBe('illit')
  })

  it('matche les variantes de (G)I-DLE', () => {
    expect(matchGroup('(G)I-DLE', GROUPS)?.slug).toBe('gidle')
    expect(matchGroup('GIDLE', GROUPS)?.slug).toBe('gidle')
    expect(matchGroup('G-IDLE', GROUPS)?.slug).toBe('gidle')
    expect(matchGroup('I-DLE', GROUPS)?.slug).toBe('gidle')
  })

  it('retourne null pour un groupe non suivi', () => {
    expect(matchGroup('Krystal', GROUPS)).toBeNull()
    expect(matchGroup('NewJeans', GROUPS)).toBeNull()
  })
})
