import { describe, it, expect } from 'vitest'
import { episodeHref, eventHref, isExternalHref } from './href'

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

  it('music_show connu → page ÉPISODE interne (Lot N 2026-07-17), stage_url ou pas', () => {
    // 06:25Z le 19/07 = 15:25 KST le 19/07 → jour KST 2026-07-19.
    expect(
      eventHref({
        ...base,
        type: 'music_show',
        title: 'Inkigayo',
        start_at: '2026-07-19T06:25:00Z',
        stage_url: 'https://www.youtube.com/watch?v=abc',
      }),
    ).toBe('/show/inkigayo/2026-07-19')
  })

  it('music_show inconnu du descripteur avec stage_url YouTube → repli YouTube', () => {
    const url = 'https://www.youtube.com/watch?v=abc'
    expect(
      eventHref({ ...base, type: 'music_show', title: 'Some Special Show', stage_url: url }),
    ).toBe(url)
  })

  it('music_show inconnu sans stage_url → group page', () => {
    expect(eventHref({ ...base, type: 'music_show', title: 'Some Special Show' })).toBe(
      '/groups/aespa',
    )
  })

  it('music_show inconnu avec un stage_url non-YouTube (bad data) → group page', () => {
    expect(
      eventHref({
        ...base,
        type: 'music_show',
        title: 'Some Special Show',
        stage_url: 'https://example.com/clip',
      }),
    ).toBe('/groups/aespa')
  })

  it('falls back to /groups/ when no group slug', () => {
    expect(eventHref({ type: 'release', slug: null, stage_url: null, groups: null })).toBe(
      '/groups/',
    )
  })
})

describe('episodeHref', () => {
  it('titre connu + start_at → /show/[id]/[jour KST]', () => {
    // 15:30Z = 00:30 KST le LENDEMAIN — le jour de l'épisode est le jour KST.
    expect(episodeHref({ title: 'Music Bank', start_at: '2026-07-17T15:30:00Z' })).toBe(
      '/show/music-bank/2026-07-18',
    )
  })

  it('titre inconnu ou start_at manquant → null', () => {
    expect(episodeHref({ title: 'Mystery Show', start_at: '2026-07-17T08:00:00Z' })).toBeNull()
    expect(episodeHref({ title: 'Inkigayo', start_at: null })).toBeNull()
  })
})

describe('isExternalHref', () => {
  it('http(s) is external', () => {
    expect(isExternalHref('https://youtube.com')).toBe(true)
    expect(isExternalHref('/mv/x')).toBe(false)
  })
})
