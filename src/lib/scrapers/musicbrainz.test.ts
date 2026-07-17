import { describe, it, expect } from 'vitest'
import { pickArtistMatch, extractLinks, extractCurrentMembers, parsePerson } from './musicbrainz'

// Fixtures TRIMÉES de réponses réelles ws/2 (aespa, fetch du 2026-07-17).

const SEARCH_AESPA = {
  artists: [
    {
      id: 'b51c672b-85e0-48fe-8648-470a2422229f',
      score: 100,
      name: 'aespa',
      'sort-name': 'aespa',
      type: 'Group',
    },
    { id: 'other', score: 60, name: 'Aespa Tribute', 'sort-name': 'Aespa Tribute', type: 'Group' },
  ],
}

const ARTIST_AESPA = {
  name: 'aespa',
  relations: [
    {
      'target-type': 'url',
      type: 'free streaming',
      url: { resource: 'https://open.spotify.com/artist/6YVMFz59CuY7ngCxTxjpxE' },
    },
    {
      'target-type': 'url',
      type: 'free streaming',
      url: { resource: 'https://vk.com/artist/aespa' },
    },
    {
      'target-type': 'url',
      type: 'free streaming',
      url: { resource: 'https://www.deezer.com/artist/113547672' },
    },
    {
      'target-type': 'url',
      type: 'social network',
      url: { resource: 'https://twitter.com/aespa_Official' },
    },
    {
      'target-type': 'url',
      type: 'social network',
      url: { resource: 'https://www.instagram.com/aespa_official/' },
    },
    {
      'target-type': 'url',
      type: 'social network',
      url: { resource: 'https://www.tiktok.com/@aespa_official' },
    },
    {
      'target-type': 'url',
      type: 'social network',
      url: { resource: 'https://www.weibo.com/aespa' },
    },
    {
      'target-type': 'url',
      type: 'streaming',
      url: { resource: 'https://music.apple.com/gb/artist/1540251304' },
    },
    {
      'target-type': 'url',
      type: 'streaming',
      url: { resource: 'https://music.apple.com/us/artist/1540251304' },
    },
    {
      'target-type': 'url',
      type: 'streaming',
      url: { resource: 'https://tidal.com/artist/22211784' },
    },
    {
      'target-type': 'url',
      type: 'youtube',
      url: { resource: 'https://www.youtube.com/channel/UC9GtSLeksfK4yuJ_g1lgQbg' },
    },
    { 'target-type': 'url', type: 'lyrics', url: { resource: 'https://genius.com/artists/Aespa' } },
    {
      'target-type': 'artist',
      type: 'member of band',
      ended: false,
      direction: 'backward',
      artist: { id: 'cb8a4667-0001', name: '지젤' },
    },
    {
      'target-type': 'artist',
      type: 'member of band',
      ended: false,
      direction: 'backward',
      artist: { id: '38aed25b-0002', name: '카리나' },
    },
    {
      'target-type': 'artist',
      type: 'member of band',
      ended: true,
      direction: 'backward',
      artist: { id: 'gone-0003', name: 'Ex Member' },
    },
  ],
}

const PERSON_KARINA = {
  name: '카리나',
  'sort-name': 'KARINA',
  type: 'Person',
  'life-span': { begin: '2000-04-11', end: null, ended: false },
}

describe('pickArtistMatch — match strict', () => {
  it('prend le score 100 au nom normalisé égal', () => {
    expect(pickArtistMatch(SEARCH_AESPA, 'aespa')?.id).toBe('b51c672b-85e0-48fe-8648-470a2422229f')
  })

  it('rejette un score faible même si le nom ressemble', () => {
    expect(pickArtistMatch({ artists: [SEARCH_AESPA.artists[1]] }, 'Aespa Tribute')).toBeNull()
  })

  it('rejette un nom différent malgré un bon score (jamais d’enrichissement ambigu)', () => {
    expect(pickArtistMatch(SEARCH_AESPA, 'TRENDZ')).toBeNull()
  })
})

describe('extractLinks — mapping domaine → clés LinksBar', () => {
  it('mappe les rels réelles vers les clés supportées, première URL par clé', () => {
    const links = extractLinks(ARTIST_AESPA)
    expect(links).toEqual({
      spotify: 'https://open.spotify.com/artist/6YVMFz59CuY7ngCxTxjpxE',
      deezer: 'https://www.deezer.com/artist/113547672',
      twitter: 'https://twitter.com/aespa_Official',
      instagram: 'https://www.instagram.com/aespa_official/',
      tiktok: 'https://www.tiktok.com/@aespa_official',
      weibo: 'https://www.weibo.com/aespa',
      apple_music: 'https://music.apple.com/gb/artist/1540251304',
      tidal: 'https://tidal.com/artist/22211784',
      youtube: 'https://www.youtube.com/channel/UC9GtSLeksfK4yuJ_g1lgQbg',
    })
    // vk.com / genius : domaines non supportés → ignorés.
    expect(Object.values(links)).not.toContain('https://vk.com/artist/aespa')
  })
})

describe('extractCurrentMembers', () => {
  it('garde les member-of-band non terminés seulement', () => {
    const members = extractCurrentMembers(ARTIST_AESPA)
    expect(members.map((m) => m.name)).toEqual(['지젤', '카리나'])
  })
})

describe('parsePerson', () => {
  it('extrait sort-name romanisé + birthday complet (cas réel KARINA)', () => {
    expect(parsePerson(PERSON_KARINA)).toEqual({
      name: '카리나',
      sortName: 'KARINA',
      birthday: '2000-04-11',
    })
  })

  it('une année seule n’est pas un birthday', () => {
    expect(
      parsePerson({ name: 'X', 'sort-name': 'X', 'life-span': { begin: '2000' } }).birthday,
    ).toBeNull()
  })
})
