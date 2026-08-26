import { describe, it, expect, beforeAll, vi } from 'vitest'
import { faceCrop, isSpotifyImage } from './cloudinary'
import { groupBannerSrc } from '@/lib/groups/banner'

// CONTRAT DE CONFORMITÉ. Les Design Guidelines Spotify sont explicites sur
// l'artwork : « Artwork must be kept in its original form », « Don't crop the
// artwork in any way ». Les Developer Terms IV.2.1(b) autorisent en revanche
// nommément le redimensionnement : « You may adjust the size of metadata or
// cover art as necessary ».
//
// L'app servait `c_fill,g_auto` — un recadrage — sur 185 groupes dont
// l'`image_url` pointe sur `i.scdn.co`, et étirait ce carré en bandeau 3,2:1
// sur 34 d'entre eux. Ces tests interdisent le retour en arrière.
describe('isSpotifyImage', () => {
  it('reconnaît le CDN Spotify', () => {
    expect(isSpotifyImage('https://i.scdn.co/image/ab6761610000e5eb0123')).toBe(true)
  })

  it("refuse un hôte étranger qui MENTIONNE le CDN — l'ancrage est sur le host", () => {
    // Un `includes('i.scdn.co')` aurait accepté celle-ci, et `image_url` est
    // alimenté par un scraper : la même classe de faille que `isOwnStorageUrl`.
    expect(isSpotifyImage('https://attaquant.example/img?src=i.scdn.co/x.jpg')).toBe(false)
    expect(isSpotifyImage('https://i.scdn.co.attaquant.example/x.jpg')).toBe(false)
  })

  it('ne casse pas sur une URL invalide', () => {
    expect(isSpotifyImage('pas-une-url')).toBe(false)
  })
})

describe('faceCrop : jamais de recadrage sur une image Spotify', () => {
  // `CLOUD` est lu au CHARGEMENT du module : poser la variable dans un
  // `beforeAll` arrive trop tard, `faceCrop` renverrait l'URL brute et le test
  // passerait pour de mauvaises raisons. On recharge donc le module.
  let faceCropAvecCloud: typeof faceCrop
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'test-cloud'
    vi.resetModules()
    faceCropAvecCloud = (await import('./cloudinary')).faceCrop
  })

  it('redimensionne (c_fit) une image Spotify, sans la rogner', () => {
    const u = faceCropAvecCloud('https://i.scdn.co/image/abc', 64, 64)
    expect(u).toContain('c_fit')
    expect(u).not.toContain('c_fill')
    expect(u).not.toContain('g_auto')
  })

  it('garde le recadrage centré sujet pour les autres origines', () => {
    // fandom, notre bucket, YouTube : rien ne l'interdit, et `g_auto` cadre
    // bien mieux une photo de groupe.
    expect(faceCropAvecCloud('https://static.wikia.nocookie.net/kpop/x.png', 64, 64)).toContain(
      'c_fill,g_auto',
    )
  })
})

describe('groupBannerSrc : pas de bandeau tiré d’un carré Spotify', () => {
  const base = { banner_url: null, banner_yt_url: null, image_landscape: null }

  it('renvoie null plutôt qu’un carré Spotify étiré en 3,2:1', () => {
    expect(groupBannerSrc({ ...base, image_url: 'https://i.scdn.co/image/abc' })).toBeNull()
  })

  it('accepte encore une image d’une autre origine', () => {
    const u = groupBannerSrc({ ...base, image_url: 'https://projet.supabase.co/x.webp' })
    expect(u).not.toBeNull()
  })

  it('préfère toujours le crop MANUEL de l’admin, quelle que soit l’origine', () => {
    // Un cadrage décidé à la main reste prioritaire : il n'est pas dérivé de
    // l'artwork Spotify, c'est une image que l'admin a composée.
    const u = groupBannerSrc({
      ...base,
      banner_url: 'https://projet.supabase.co/banners/x.webp',
      image_url: 'https://i.scdn.co/image/abc',
    })
    expect(u).toContain('projet.supabase.co')
  })
})
