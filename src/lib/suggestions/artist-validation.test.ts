import { describe, it, expect } from 'vitest'
import {
  parseArtistSuggestionInput,
  MAX_ARTIST_NAME,
  MAX_MEMBERS,
  type RawArtistSuggestion,
} from './artist-validation'

const base: RawArtistSuggestion = { name: 'NewJeans', kind: 'group' }

function value(raw: RawArtistSuggestion) {
  const r = parseArtistSuggestionInput(raw)
  if ('error' in r) throw new Error(`expected value, got error: ${r.error}`)
  return r.value
}

describe('parseArtistSuggestionInput — name', () => {
  it('accepte une saisie minimale valide', () => {
    const v = value(base)
    expect(v.name).toBe('NewJeans')
    expect(v.kind).toBe('group')
    expect(v.members).toEqual([])
    expect(v.agency).toBeNull()
    expect(v.sourceUrl).toBeNull()
  })

  it('rejette un nom vide ou espaces', () => {
    expect('error' in parseArtistSuggestionInput({ ...base, name: '   ' })).toBe(true)
    expect('error' in parseArtistSuggestionInput({ ...base, name: undefined })).toBe(true)
  })

  it(`rejette un nom > ${MAX_ARTIST_NAME} caractères`, () => {
    expect(
      'error' in parseArtistSuggestionInput({ ...base, name: 'a'.repeat(MAX_ARTIST_NAME + 1) }),
    ).toBe(true)
    expect(
      'error' in parseArtistSuggestionInput({ ...base, name: 'a'.repeat(MAX_ARTIST_NAME) }),
    ).toBe(false)
  })
})

describe('parseArtistSuggestionInput — kind', () => {
  it('rejette un kind manquant ou inconnu', () => {
    expect('error' in parseArtistSuggestionInput({ name: 'X' })).toBe(true)
    expect('error' in parseArtistSuggestionInput({ name: 'X', kind: 'duo' })).toBe(true)
  })

  it('accepte group et solo', () => {
    expect(value({ name: 'X', kind: 'group' }).kind).toBe('group')
    expect(value({ name: 'IU', kind: 'solo' }).kind).toBe('solo')
  })
})

describe('parseArtistSuggestionInput — color / debut / urls', () => {
  it('valide un hex #rrggbb et le met en minuscules', () => {
    expect(value({ ...base, colorHex: '#1ABC9C' }).colorHex).toBe('#1abc9c')
  })

  it('rejette un hex mal formé', () => {
    expect('error' in parseArtistSuggestionInput({ ...base, colorHex: '1abc9c' })).toBe(true)
    expect('error' in parseArtistSuggestionInput({ ...base, colorHex: '#xyzxyz' })).toBe(true)
    expect('error' in parseArtistSuggestionInput({ ...base, colorHex: '#fff' })).toBe(true)
  })

  it('valide une debut date YYYY-MM-DD, rejette le reste', () => {
    expect(value({ ...base, debutDate: '2026-06-15' }).debutDate).toBe('2026-06-15')
    expect('error' in parseArtistSuggestionInput({ ...base, debutDate: 'June 2026' })).toBe(true)
    expect('error' in parseArtistSuggestionInput({ ...base, debutDate: '2026-6-1' })).toBe(true)
  })

  it('valide les URLs http(s), rejette le reste, et accepte le vide → null', () => {
    expect(value({ ...base, imageUrl: 'https://img.test/a.jpg' }).imageUrl).toBe(
      'https://img.test/a.jpg',
    )
    expect('error' in parseArtistSuggestionInput({ ...base, imageUrl: 'ftp://x' })).toBe(true)
    expect(
      'error' in parseArtistSuggestionInput({ ...base, sourceUrl: 'javascript:alert(1)' }),
    ).toBe(true)
    expect(value({ ...base, imageUrl: '' }).imageUrl).toBeNull()
  })
})

describe('parseArtistSuggestionInput — members', () => {
  it('parse un JSON de membres pour un groupe', () => {
    const members = JSON.stringify([{ name: 'Minji', position: 'Leader' }, { name: 'Hanni' }])
    const v = value({ ...base, members })
    expect(v.members).toEqual([
      { name: 'Minji', position: 'Leader' },
      { name: 'Hanni', position: null },
    ])
  })

  it('ignore les membres pour un solo', () => {
    const members = JSON.stringify([{ name: 'Ghost' }])
    expect(value({ name: 'IU', kind: 'solo', members }).members).toEqual([])
  })

  it('tolère un JSON invalide ou non-tableau (→ [])', () => {
    expect(value({ ...base, members: 'not json' }).members).toEqual([])
    expect(value({ ...base, members: '{"name":"x"}' }).members).toEqual([])
  })

  it('saute les entrées sans nom et cappe à MAX_MEMBERS', () => {
    const many = JSON.stringify([
      { name: '' },
      { position: 'no name' },
      ...Array.from({ length: MAX_MEMBERS + 5 }, (_, i) => ({ name: `M${i}` })),
    ])
    const v = value({ ...base, members: many })
    expect(v.members.length).toBe(MAX_MEMBERS)
    expect(v.members[0].name).toBe('M0')
  })
})
