import { describe, expect, it } from 'vitest'
import { hasKpopSignal } from './channel-discovery'

// Cas RÉELS : 3 chaînes d'artistes étrangers avaient été seedées sur des
// groupes k-pop homonymes, et leurs clips s'affichaient en prod (nuit
// 2026-08-21). Les titres ci-dessous sont ceux qui ont servi au seed.
describe('hasKpopSignal', () => {
  it('refuse un homonyme étranger sans hangul ni lien de chaîne', () => {
    expect(
      hasKpopSignal(
        {
          channelTitle: 'Eclipse Records',
          hits: ['GENUS ORDINIS DEI - Three Kings (OFFICIAL MUSIC VIDEO) [Symphonic Death Metal]'],
        },
        { name: 'GENUS', agency: 'JUST FOCUS ENTERTAINMENT' },
      ),
    ).toBe(false)
    expect(
      hasKpopSignal(
        { channelTitle: 'manifest', hits: ['manifest - Toz Pembe | Official Music Video'] },
        { name: 'TOZ', agency: 'YY Entertainment' },
      ),
    ).toBe(false)
  })

  it('refuse un artiste japonais (kanji ≠ hangul)', () => {
    expect(
      hasKpopSignal(
        { channelTitle: '清水翔太 / Shota Shimizu', hits: ['清水翔太『PUZZLE』MV'] },
        { name: 'Puzzle', agency: 'Good Choice Entertainment' },
      ),
    ).toBe(false)
  })

  it('accepte un titre portant du hangul', () => {
    expect(
      hasKpopSignal(
        { channelTitle: 'JYP Entertainment', hits: ['OURBIRTHDAY “SQUEEZY” M/V', '아워벌스데이'] },
        { name: 'OURBIRTHDAY', agency: 'INNIT Entertainment' },
      ),
    ).toBe(true)
  })

  it('accepte la chaîne du label même sans hangul (sorties anglophones)', () => {
    expect(
      hasKpopSignal(
        { channelTitle: 'JYP Entertainment', hits: ['VCHA "Girls of the Year" M/V'] },
        { name: 'VCHA', agency: 'JYP Entertainment' },
      ),
    ).toBe(true)
  })

  it('accepte la chaîne officielle du groupe lui-même', () => {
    expect(
      hasKpopSignal(
        { channelTitle: 'TOZ Official', hits: ["TOZ - 'Magic Hour' Official M/V"] },
        { name: 'TOZ', agency: 'YY Entertainment' },
      ),
    ).toBe(true)
  })
})
