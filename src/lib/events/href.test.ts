import { describe, it, expect } from 'vitest'
import { eventHref, isExternalHref } from './href'

const base = {
  slug: null as string | null,
  source_url: null as string | null,
  groups: { slug: 'aespa' },
}

describe('eventHref', () => {
  it('MV with a slug → internal MV page', () => {
    expect(eventHref({ ...base, type: 'mv', slug: 'aespa-whiplash-mv' })).toBe(
      '/mv/aespa-whiplash-mv',
    )
  })

  it('release → group page (never the scraped source)', () => {
    expect(
      eventHref({ ...base, type: 'release', slug: 'x', source_url: 'https://kpopofficial.com/x' }),
    ).toBe('/groups/aespa')
  })

  it('anniversary → group page', () => {
    expect(eventHref({ ...base, type: 'anniversary' })).toBe('/groups/aespa')
  })

  it('music_show with a YouTube source → that YouTube URL', () => {
    const url = 'https://www.youtube.com/watch?v=abc'
    expect(eventHref({ ...base, type: 'music_show', source_url: url })).toBe(url)
  })

  it('music_show with a non-YouTube (carrd) source → group page, not the source', () => {
    expect(
      eventHref({ ...base, type: 'music_show', source_url: 'https://liveshowupdatess.carrd.co' }),
    ).toBe('/groups/aespa')
  })

  it('falls back to /groups/ when no group slug', () => {
    expect(eventHref({ type: 'release', slug: null, source_url: null, groups: null })).toBe(
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
