import { describe, expect, it } from 'vitest'
import { parseChartWinnersWikitext, validateAuthority } from './episode-numbers'

// Extrait RÉEL de « List of Music Bank Chart winners (2026) » (fetch API
// MediaWiki du 2026-07-18) — la row 1,299/July 17 prouve que le « 1295 »
// parsé du carrd était faux.
const REAL_SNIPPET = `
|-
! scope="row" style="text-align:center" | 1,298
| {{dts|July 10}}
| 7,271
| <ref>{{Cite web|url=https://example.org}}</ref>
|-
! scope="row" style="text-align:center" | 1,299
| {{dts|July 17}}
| [[Yeonjun]]<!--1st-->
| "Ice Cream"
| 6,920
| <ref>{{Cite web|url=https://example.org}}</ref>
`

describe('parseChartWinnersWikitext', () => {
  it('extrait les paires (épisode, date) du format réel 2026', () => {
    const eps = parseChartWinnersWikitext(REAL_SNIPPET, 2026)
    expect(eps).toEqual([
      { episode: 1298, date: '2026-07-10' },
      { episode: 1299, date: '2026-07-17' },
    ])
  })

  it('tolère une année explicite dans dts', () => {
    const eps = parseChartWinnersWikitext(
      '! scope="row" | 400\n| {{dts|November 11, 2025}}\n| x',
      2026,
    )
    expect(eps).toEqual([{ episode: 400, date: '2025-11-11' }])
  })

  it('ignore les rows sans date dts', () => {
    expect(parseChartWinnersWikitext('! scope="row" | 12\n| pas de date', 2026)).toEqual([])
  })
})

describe('validateAuthority', () => {
  it('accepte une série croissante', () => {
    expect(
      validateAuthority([
        { episode: 1298, date: '2026-07-10' },
        { episode: 1299, date: '2026-07-17' },
      ]),
    ).toEqual([])
  })

  it('signale des épisodes non croissants', () => {
    const problems = validateAuthority([
      { episode: 1299, date: '2026-07-10' },
      { episode: 1295, date: '2026-07-17' },
    ])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('non croissants')
  })
})
