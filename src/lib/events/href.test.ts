import { describe, it, expect } from 'vitest'
import { eventHref, isExternalHref } from './href'

const base = {
  slug: null as string | null,
  stage_url: null as string | null,
  groups: { slug: 'aespa' },
}

describe('eventHref', () => {
  it('MV with a slug → internal MV page', () => {
    expect(eventHref({ ...base, type: 'mv', slug: 'aespa-whiplash-mv' })).toBe(
      '/mv/aespa-whiplash-mv',
    )
  })

  it('release → group page, even with a stage_url (only music_show routes external)', () => {
    expect(
      eventHref({
        ...base,
        type: 'release',
        slug: 'x',
        stage_url: 'https://www.youtube.com/watch?v=abc',
      }),
    ).toBe('/groups/aespa')
  })

  it('anniversary → group page', () => {
    expect(eventHref({ ...base, type: 'anniversary' })).toBe('/groups/aespa')
  })

  it('music_show with a YouTube stage_url → that YouTube URL', () => {
    const url = 'https://www.youtube.com/watch?v=abc'
    expect(eventHref({ ...base, type: 'music_show', stage_url: url })).toBe(url)
  })

  it('music_show without stage_url (source carrd jamais routée) → group page', () => {
    expect(eventHref({ ...base, type: 'music_show' })).toBe('/groups/aespa')
  })

  it('music_show with a non-YouTube stage_url (bad data) → group page', () => {
    expect(eventHref({ ...base, type: 'music_show', stage_url: 'https://example.com/clip' })).toBe(
      '/groups/aespa',
    )
  })

  it('falls back to /groups/ when no group slug', () => {
    expect(eventHref({ type: 'release', slug: null, stage_url: null, groups: null })).toBe(
      '/groups/',
    )
  })
})

describe('isExternalHref', () => {
  it('http(s) is external', () => {
    expect(isExternalHref('https://youtube.com')).toBe(true)
    expect(isExternalHref('/mv/x')).toBe(false)
  })
})
