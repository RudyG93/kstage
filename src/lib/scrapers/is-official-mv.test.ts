import { describe, it, expect } from 'vitest'
import { isOfficialMvTitle } from './is-official-mv'

describe('isOfficialMvTitle', () => {
  const official = [
    "aespa 에스파 'Whiplash' MV",
    "ILLIT (아일릿) 'Magnetic' Official MV",
    "BABYMONSTER - 'SHEESH' M/V",
    "(여자)아이들((G)I-DLE) 'TOMBOY' Official Music Video",
    "NewJeans (뉴진스) 'Supernatural' Music Video",
    "aespa 'Armageddon' MV",
    "RIIZE 라이즈 'Boom Boom Bass' MV",
    "LE SSERAFIM (르세라핌) 'CRAZY' OFFICIAL MV",
    "i-dle (아이들) 'Mono (Feat. skaiwater)' Official Music Video",
  ]
  const notOfficial: [string, string][] = [
    ["aespa 'Whiplash' MV Teaser", 'blacklist:teaser'],
    ["ILLIT 'Magnetic' Lyric Video", 'blacklist:lyric'],
    ["BABYMONSTER 'SHEESH' DANCE PRACTICE", 'blacklist:dance practice'],
    ["aespa 'Supernova' Performance Video", 'blacklist:performance'],
    ["(G)I-DLE 'TOMBOY' Live Clip", 'blacklist:live'],
    ["NewJeans 'Supernatural' (Official Audio)", 'blacklist:audio'],
    ["aespa 'LEMONADE' Behind the scenes", 'blacklist:behind'],
    ["ILLIT 'Magnetic' M/V Making Film", 'blacklist:making'],
    ["aespa 'Whiplash' Special Clip", 'blacklist:special clip'],
    ["RIIZE 'Get A Guitar' Dance Cover", 'blacklist:dance cover'],
    ["aespa 'Drama' Stage @ Music Core", 'blacklist:stage'],
    ["BABYMONSTER 'SHEESH' @ Inkigayo", 'blacklist:music show'],
    ["aespa 'Some Song' (Visualizer)", 'no-mv-marker'],
    ['Team MVP awards recap', 'no-mv-marker'],
    // Cas prod réel : vrai MV BABYMONSTER titré « OUT NOW ». Le mode strict le
    // sacrifie volontairement (le clip principal sans « OUT NOW » est gardé).
    ["'SUGAR HONEY ICE TEA' M/V OUT NOW", 'blacklist:out now'],
  ]

  it.each(official)('officiel : %s', (title) => {
    expect(isOfficialMvTitle(title).official).toBe(true)
  })

  it.each(notOfficial)('rejeté : %s → %s', (title, reason) => {
    const res = isOfficialMvTitle(title)
    expect(res.official).toBe(false)
    expect(res.reason).toBe(reason)
  })

  it('ne confond pas MVP avec MV', () => {
    expect(isOfficialMvTitle('MVP highlights').official).toBe(false)
  })
})
