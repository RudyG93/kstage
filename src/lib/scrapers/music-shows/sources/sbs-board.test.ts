import { describe, it, expect } from 'vitest'
import { parseBoardPreemptions } from './sbs-board'

// Rows réelles du board Inkigayo (fetch Jina du 2026-08-08) : l'avis 결방
// annonçait deux dimanches sans épisode — l'alerte monitor « J-1 sans
// lineup: Inkigayo » était un faux positif métier.
const BOARD_MD = `
| 768 | [[결방 공지] 8월 2일(일), 8월 9일(일) SBS 인기가요](https://programs.sbs.co.kr/enter/gayo/board/54772?cmd=view&board_no=768) | 관리자 | 26-07-28 | 1200 |
| 767 | [[1319회] 7월 26일 인기가요 출연진](https://programs.sbs.co.kr/enter/gayo/board/54772?cmd=view&board_no=767) | 관리자 | 26-07-24 | 5000 |
| 766 | [[1318회] 7월 19일 인기가요 출연진](https://programs.sbs.co.kr/enter/gayo/board/54772?cmd=view&board_no=766) | 관리자 | 26-07-17 | 4800 |
`

describe('parseBoardPreemptions', () => {
  it('extrait les dates 결방 en clés KST, ignore les posts épisode', () => {
    const out = parseBoardPreemptions(BOARD_MD)
    expect(out.map((p) => p.kstDay)).toEqual(['2026-08-02', '2026-08-09'])
    expect(out[0].postUrl).toContain('board_no=768')
  })

  it('wrap décembre → janvier : la date préemptée passe à l’année suivante', () => {
    const md = `| 800 | [[결방 공지] 1월 4일(일) SBS 인기가요](https://x.example/p) | 관리자 | 26-12-28 | 10 |`
    expect(parseBoardPreemptions(md).map((p) => p.kstDay)).toEqual(['2027-01-04'])
  })

  it('board sans avis 결방 → vide', () => {
    const md = `| 767 | [[1319회] 7월 26일 인기가요 출연진](https://x.example/p) | 관리자 | 26-07-24 | 5000 |`
    expect(parseBoardPreemptions(md)).toEqual([])
  })

  it('dates invalides ignorées, doublons dédupliqués', () => {
    const md = `
| 801 | [[결방 공지] 13월 40일, 8월 9일 SBS 인기가요](https://x.example/a) | 관리자 | 26-08-01 | 10 |
| 802 | [[결방 안내] 8월 9일 인기가요](https://x.example/b) | 관리자 | 26-08-02 | 10 |
`
    expect(parseBoardPreemptions(md).map((p) => p.kstDay)).toEqual(['2026-08-09'])
  })
})
