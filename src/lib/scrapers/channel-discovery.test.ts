import { describe, it, expect } from 'vitest'
import { filterMvSearchHits, type SearchHit } from './channel-discovery'

const hit = (title: string, channelId = 'UC1'): SearchHit => ({
  videoId: 'v',
  title,
  channelId,
  channelTitle: 'chan',
})

// Fixtures bruitées : la recherche `"<nom>" MV` remonte teasers, reactions,
// fancams et les MVs d'AUTRES groupes — seuls les vrais MVs du groupe passent.
describe('filterMvSearchHits', () => {
  it('garde les vrais MVs du groupe (title-match + marqueur MV)', () => {
    const hits = [
      hit("NEXZ 'Ride the Vibe' M/V"),
      hit('NEXZ - Miracle MV'),
      hit('NEXZ (넥스지) Official Music Video - O-RLY'),
    ]
    expect(filterMvSearchHits(hits, 'NEXZ')).toHaveLength(3)
  })

  it('écarte les dérivés : teaser, reaction, fancam, dance practice, behind', () => {
    const hits = [
      hit("NEXZ 'Ride the Vibe' MV Teaser"),
      hit('NEXZ Ride the Vibe MV REACTION!!'),
      hit('NEXZ Ride the Vibe MV (dance practice)'),
      hit('NEXZ 직캠 MV fancam'),
      hit('NEXZ MV Behind the scenes'),
    ]
    expect(filterMvSearchHits(hits, 'NEXZ')).toEqual([])
  })

  it("écarte les MVs d'un autre groupe et les vidéos sans marqueur MV", () => {
    const hits = [
      hit("IVE 'Rebel Heart' MV"), // autre groupe
      hit('NEXZ interview 2026'), // pas un MV
    ]
    expect(filterMvSearchHits(hits, 'NEXZ')).toEqual([])
  })

  it('name_aliases (0061) : un MV titré sous le hangul officiel compte comme hit', () => {
    // Sans alias, « 선미 » ne matche pas « Sunmi » — la classe de bug qui
    // laissait les groupes hangul/rebrandés sans attribution (BACKLOG 2026-07-20).
    const hits = [hit("선미 'Balloon in Love' MV")]
    expect(filterMvSearchHits(hits, 'Sunmi')).toEqual([])
    expect(filterMvSearchHits(hits, 'Sunmi', ['선미'])).toHaveLength(1)
  })
})
