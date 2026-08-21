import { describe, expect, it } from 'vitest'
import { parseSpotifyArtistId, spotifyNameMatches } from './spotify'

describe('parseSpotifyArtistId', () => {
  it('extrait l’id d’une URL artiste', () => {
    expect(parseSpotifyArtistId('https://open.spotify.com/artist/4epcW7GdBzjUkKmU1hIcMP')).toBe(
      '4epcW7GdBzjUkKmU1hIcMP',
    )
  })

  it('renvoie null hors URL artiste', () => {
    expect(parseSpotifyArtistId(null)).toBeNull()
    expect(parseSpotifyArtistId('https://open.spotify.com/album/xyz')).toBeNull()
  })
})

describe('spotifyNameMatches', () => {
  it('accepte l’égalité et les variantes typographiques', () => {
    expect(spotifyNameMatches('aespa', 'aespa')).toBe(true)
    expect(spotifyNameMatches('Kiss of Life', 'KISS OF LIFE')).toBe(true)
    expect(spotifyNameMatches('Rosé', 'ROSÉ')).toBe(true)
  })

  it('accepte un nom Spotify PUREMENT coréen via groups.name_aliases', () => {
    // Le blocage réel : norm() était ASCII-only, donc '스텔라이브' devenait ''
    // et le garde renvoyait false — refresh-images restait `partial` depuis le
    // 2026-08-16 et rendait le job GitHub monitor rouge chaque jour.
    expect(spotifyNameMatches('StelLive', '스텔라이브')).toBe(false)
    expect(spotifyNameMatches('StelLive', '스텔라이브', ['스텔라이브'])).toBe(true)
  })

  it('accepte TXT via son alias DB (le Record codé en dur est supprimé)', () => {
    expect(
      spotifyNameMatches('TXT', 'TOMORROW X TOGETHER', [
        '투모로우바이투게더',
        'TOMORROW X TOGETHER',
      ]),
    ).toBe(true)
  })

  it('accepte une inclusion dans les deux sens', () => {
    // Cas réels du roster : le nom Spotify porte un suffixe ou un préfixe.
    expect(spotifyNameMatches('i-dle', '(G)I-DLE')).toBe(true)
    expect(spotifyNameMatches('GENBLUE', 'GENBLUE幻藍小熊')).toBe(true)
  })

  it('refuse un artiste sans rapport — la classe de bug WEi / « Weird Al »', () => {
    expect(spotifyNameMatches('WEi', '"Weird Al" Yankovic')).toBe(false)
    expect(spotifyNameMatches('IVE', 'Sistar')).toBe(false)
  })

  it('refuse quand un des deux noms est vide après normalisation', () => {
    expect(spotifyNameMatches('', 'aespa')).toBe(false)
    expect(spotifyNameMatches('aespa', '!!!')).toBe(false)
  })

  it('ignore un alias vide sans tout faire matcher', () => {
    expect(spotifyNameMatches('WEi', '"Weird Al" Yankovic', ['', '   '])).toBe(false)
  })
})
