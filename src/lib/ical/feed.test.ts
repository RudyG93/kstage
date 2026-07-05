import { describe, it, expect } from 'vitest'
import { buildCalendarFeed, type FeedEventRow } from './feed'
import type { UpcomingEvent } from '@/lib/events/queries'

const SITE = 'https://kstage.vercel.app'

const row = (over: Partial<FeedEventRow> & { id: string }): FeedEventRow =>
  ({
    group_id: `gid-${over.id}`,
    type: 'mv',
    title: 'Whiplash',
    slug: 'whiplash',
    start_at: '2026-07-09T09:00:00+00:00',
    end_at: null,
    created_at: '2026-07-01T00:00:00+00:00',
    episode_number: null,
    source_url: 'https://youtube.com/watch?v=x',
    groups: { slug: 'aespa', name: 'aespa' },
    ...over,
  }) as unknown as FeedEventRow

describe('buildCalendarFeed', () => {
  it('event simple : UID {id}@kstage, DTEND start+1h, URL absolue', () => {
    const ics = buildCalendarFeed({ events: [row({ id: 'e1' })], anniversaries: [], siteUrl: SITE })
    expect(ics).toContain('UID:e1@kstage')
    expect(ics).toContain('DTSTART:20260709T090000Z')
    expect(ics).toContain('DTEND:20260709T100000Z') // +1h, pas de end_at
    expect(ics).toContain('SUMMARY:aespa — Whiplash')
    expect(ics).toContain(`URL:${SITE}/mv/whiplash`)
    expect(ics).toContain('DTSTAMP:20260701T000000Z') // created_at, pas now()
  })

  it('épisode music show fusionné : UID de clé de fusion + lineup en SUMMARY', () => {
    const show = (id: string, name: string) =>
      row({
        id,
        group_id: `gid-${name.toLowerCase()}`,
        type: 'music_show',
        title: 'Music Bank',
        slug: null,
        start_at: '2026-07-10T08:00:00+00:00',
        source_url: 'https://liveshowupdatess.carrd.co/',
        episode_number: id === 'b' ? 742 : null,
        groups: { slug: name.toLowerCase(), name } as never,
      })
    const ics = buildCalendarFeed({
      events: [show('a', 'ATEEZ'), show('b', 'RIIZE'), show('c', 'izna')],
      anniversaries: [],
      siteUrl: SITE,
    })
    // UID indépendant du représentant (stable si les follows changent).
    expect(ics).toContain('UID:mshow-music-bank-20260710T080000Z@kstage')
    expect(ics).not.toContain('UID:a@kstage')
    expect(ics).toContain('SUMMARY:Music Bank #742 — ATEEZ\\, RIIZE\\, izna')
    expect(ics).toContain(`URL:${SITE}/calendar`)
  })

  it('anniversaire : all-day sur le jour KST, UID avec année', () => {
    const anniv = {
      id: 'anniv-bday-g1-Karina',
      type: 'anniversary',
      title: 'Karina — 26',
      slug: null,
      // 2026-07-11T15:00Z = 2026-07-12 00:00 KST → le jour KST est le 12.
      start_at: '2026-07-11T15:00:00+00:00',
      episode_number: null,
      source_url: null,
      groups: { slug: 'aespa', name: 'aespa' },
    } as unknown as UpcomingEvent
    const ics = buildCalendarFeed({ events: [], anniversaries: [anniv], siteUrl: SITE })
    expect(ics).toContain('UID:anniv-bday-g1-Karina-2026@kstage')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260712')
    expect(ics).toContain('DTEND;VALUE=DATE:20260713')
    expect(ics).toContain('SUMMARY:aespa — Karina — 26')
  })

  it('feed vide : VCALENDAR valide', () => {
    const ics = buildCalendarFeed({ events: [], anniversaries: [], siteUrl: SITE })
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })
})
