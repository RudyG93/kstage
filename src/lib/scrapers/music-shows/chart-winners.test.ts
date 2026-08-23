import { describe, expect, it } from 'vitest'
import { parseChartWinners } from './chart-winners'

// Fixture RECOPIÉE des pages réelles (Music Bank et Inkigayo 2026, lues le
// 2026-08-23) — pas inventée : chaque piège ci-dessous a d'abord produit une
// sortie fausse contre la vraie page.
const MUSIC_BANK = `==Chart history==
{| class="wikitable plainrowheaders sortable" style="text-align:center"
! scope="col" | Episode
! scope="col" | Date
! scope="col" | Artist
! scope="col" | Song
! scope="col" | Points
! class=unsortable | {{Abbr|Ref.|Reference}}
|-
| {{N/A}}
| {{dts|January 2}}
| [[Nmixx]]<!-- 5th -->
| "[[Blue Valentine (Nmixx song)|Blue Valentine]]"
| 3,918
| <ref>{{Cite web|url=https://example.test/a|title=x}}</ref>
|-
! scope="row" style="text-align:center" | 1,275
| {{dts|January 9}}
| [[Say My Name (group)|Say My Name]]<!-- 1st -->
| "UFO (Attention)"
| 11,912
| <ref>{{Cite web|url=https://example.test/b|title=y}}</ref>
|-
! scope="row" style="text-align:center" | 1,280
| {{dts|February 13}}
| rowspan="2" | [[Ateez]]<!-- 11th, 12th-->
| rowspan="2" | "Adrenaline"
| 14,413
| <ref>z</ref>
|-
! scope="row" style="text-align:center" {{N/A}}
| {{dts|February 20}}
| 10,307
| <ref>w</ref>
|}`

// Inkigayo cumule les trois pièges : colspan « No show », style à guillemet
// non fermé, et {{dagger}}/{{Efn}} collés au titre.
const INKIGAYO = `==Chart history==
{| class="wikitable plainrowheaders sortable" style="text-align:center"
! scope="col" | Episode
! scope="col" | Date
|-
! scope="row" style="text-align:center" {{n/a}}
| {{dts|January 4}}
| colspan="3" {{N/a|No show, winner not announced}}
| <ref>a</ref>
|-
! scope="row" style="text-align: center" | 1,294
| {{dts|January 11}}
| rowspan="2" | [[Hwasa]] <!-- 5th, 6th -->
| rowspan="2" style="background:#FFDEAD; | "[[Good Goodbye (Hwasa song)|Good Goodbye]]" {{dagger}}{{Efn|"[[Good Goodbye (Hwasa song)|Good Goodbye]]" ranked number one for one week in [[List of Inkigayo Chart winners (2025)|2025]].}}
| 7,249
| <ref>b</ref>
|-
! scope="row" style="text-align: center" | 1,295
| {{dts|January 18}}
| 6,045
| <ref>c</ref>
|}`

describe('parseChartWinners', () => {
  it('lit une ligne simple : épisode, date, artiste, titre, rang', () => {
    const w = parseChartWinners(MUSIC_BANK, 2026)
    expect(w[1]).toEqual({
      date: '2026-01-09',
      episode: 1275,
      artist: 'Say My Name',
      song: 'UFO (Attention)',
      nth: 1,
    })
  })

  it('accepte une victoire sans numéro d’épisode ({{N/A}})', () => {
    const w = parseChartWinners(MUSIC_BANK, 2026)
    expect(w[0]).toMatchObject({ date: '2026-01-02', episode: null, artist: 'Nmixx', nth: 5 })
  })

  it('reporte artiste et titre sur la ligne couverte par un rowspan', () => {
    // Sans report, la 2e ligne lisait « 10,307 » (les POINTS) comme artiste.
    const w = parseChartWinners(MUSIC_BANK, 2026)
    const feb = w.filter((x) => x.date.startsWith('2026-02'))
    expect(feb).toHaveLength(2)
    expect(feb[0]).toMatchObject({
      date: '2026-02-13',
      artist: 'Ateez',
      song: 'Adrenaline',
      nth: 11,
    })
    expect(feb[1]).toMatchObject({
      date: '2026-02-20',
      artist: 'Ateez',
      song: 'Adrenaline',
      nth: 12,
    })
    // Le second rang vient du MÊME commentaire « 11th, 12th ».
    expect(feb[1].episode).toBeNull()
  })

  it('écarte les semaines sans vainqueur (colspan {{N/a|…}})', () => {
    const w = parseChartWinners(INKIGAYO, 2026)
    expect(w.map((x) => x.date)).not.toContain('2026-01-04')
    expect(w.some((x) => x.artist.includes('No show'))).toBe(false)
  })

  it('nettoie {{dagger}}/{{Efn}} et le style à guillemet non fermé', () => {
    const w = parseChartWinners(INKIGAYO, 2026)
    expect(w).toHaveLength(2)
    expect(w[0]).toEqual({
      date: '2026-01-11',
      episode: 1294,
      artist: 'Hwasa',
      song: 'Good Goodbye',
      nth: 5,
    })
    expect(w[1]).toEqual({
      date: '2026-01-18',
      episode: 1295,
      artist: 'Hwasa',
      song: 'Good Goodbye',
      nth: 6,
    })
  })

  it('retire la dague écrite en CARACTÈRE, pas en template', () => {
    // Music Core écrit `style="background:#FFDEAD; | "Pretty Girl" †` — le
    // titre sortait « Pretty Girl" † », guillemet orphelin compris.
    const page = `==Chart history==
{| class="wikitable"
|-
! scope="row" | 955
| {{dts|July 25}}
| [[Rescene]]<!-- 1st-->
| style="background:#FFDEAD; | "Pretty Girl" †
| 6,772
|}`
    expect(parseChartWinners(page, 2026)[0]).toEqual({
      date: '2026-07-25',
      episode: 955,
      artist: 'Rescene',
      song: 'Pretty Girl',
      nth: 1,
    })
  })

  it('ignore une page sans section Chart history plutôt que de deviner', () => {
    expect(parseChartWinners('{{Short description|None}}\nRien ici.', 2026)).toEqual([])
  })
})
