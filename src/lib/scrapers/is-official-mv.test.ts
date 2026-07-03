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
    // Soliste format occidental : « Official Video » sans « music ».
    'JENNIE - like JENNIE (Official Video)',
    'LISA - ROCKSTAR (Official Music Video)',
  ]
  const notOfficial: [string, string][] = [
    ["aespa 'Whiplash' MV Teaser", 'blacklist:teaser'],
    ["ILLIT 'Magnetic' Lyric Video", 'blacklist:lyric'],
    // La blacklist prime sur le nouveau marqueur « official video ».
    ["ROSÉ - 'toxic' (Official Lyric Video)", 'blacklist:lyric'],
    ["BABYMONSTER 'SHEESH' DANCE PRACTICE", 'blacklist:dance practice'],
    ["aespa 'Supernova' Performance Video", 'blacklist:performance'],
    ["(G)I-DLE 'TOMBOY' Live Clip", 'blacklist:live'],
    ["NewJeans 'Supernatural' (Official Audio)", 'blacklist:audio'],
    ["aespa 'LEMONADE' Behind the scenes", 'blacklist:behind'],
    ["ILLIT 'Magnetic' M/V Making Film", 'blacklist:making'],
    ['(G)I-DLE - M/V Bloopers : [I feel]', 'blacklist:bloopers'],
    ["(G)I-DLE - 'Uh-Oh' M/V 응원법", 'blacklist:fanchant'],
    ["aespa 'Whiplash' Special Clip", 'blacklist:special clip'],
    ["SHINee 'Atmos' MV Commentary", 'blacklist:commentary'],
    ['강다니엘(KANGDANIEL) - PARANOIA M/V 코멘터리', 'blacklist:commentary'],
    ["[#TAEYONG Focus] '질주 (2 Baddies)' @MV Film", 'blacklist:mv film'],
    ["RIIZE 'Get A Guitar' Dance Cover", 'blacklist:dance cover'],
    ["aespa 'Drama' Stage @ Music Core", 'blacklist:stage'],
    ["BABYMONSTER 'SHEESH' @ Inkigayo", 'blacklist:music show'],
    ["aespa 'Some Song' (Visualizer)", 'no-mv-marker'],
    ['Team MVP awards recap', 'no-mv-marker'],
    // Cas prod réel : vrai MV BABYMONSTER titré « OUT NOW ». Le mode strict le
    // sacrifie volontairement (le clip principal sans « OUT NOW » est gardé).
    ["'SUGAR HONEY ICE TEA' M/V OUT NOW", 'blacklist:out now'],
    // Making-of du tournage (BANGTANTV) — dérivé, pas le MV.
    ["진 (Jin) 'Running Wild' MV Shoot Sketch - BTS (방탄소년단)", 'blacklist:shoot sketch'],
    // ---- Audit prod 2026-07-03 : titres RÉELS passés en mv_kind='main'. ----
    // « MV촬영 » = tournage du clip (ASTRO, NCT WISH, tripleS, ITZY, Solar, BtoB).
    ['재밌었던 유정이 MV촬영 #엠제이 #MJ #아스트로 #ASTRO', 'blacklist:filming'],
    ['tripleS ∞! 오늘 MV 촬영 시작 #tripleS #트리플에스', 'blacklist:filming'],
    // « M/V BTS » / « MV bts » = behind-the-scenes (RIIZE, ASTRO, Jay Park, ILLIT).
    ["'Some Things Never Change M/V BTS #ZOONIZINI #아스트로 #ASTRO", 'blacklist:mv behind'],
    ['Fame MV bts 1 #RIIZE #라이즈#RISEandREALIZE #Fame', 'blacklist:mv behind'],
    ['Magnetic MV bts #ILLIT #아일릿 #Magnetic #SUPER_REAL_ME', 'blacklist:mv behind'],
    // « MV Highlight » = extrait/teaser (Taemin, The Boyz, MCND).
    ["태민 (TAEMIN) - 'Veil' MV Highlight", 'blacklist:mv highlight'],
    ["더보이즈 (THE BOYZ) 'AURA' MV HIGHLIGHT", 'blacklist:mv highlight'],
    // « MV Sketch » = making du tournage (Kep1er).
    ['Shooting Star MV Sketch #3 #Kep1er #케플러', 'blacklist:mv sketch'],
    // « Shorts M/V » = format vertical court (BIBI).
    ['비비 (BIBI) - 종말의 사과나무 (Apocalypse) Shorts M/V #bibi', 'blacklist:shorts'],
    // Déclinaisons non-clip (Dreamcatcher, Highlight).
    ["Dreamcatcher(드림캐쳐) 'JUSTICE' Dance Video (MV ver.)", 'blacklist:dance video'],
    ['[MV] 하이라이트(Highlight) - 불어온다 (NOT THE END) Lip ver.', 'blacklist:lip version'],
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

  it('ne confond pas le groupe Highlight avec un « MV Highlight »', () => {
    // Vrais MVs du groupe Highlight : « MV] » puis le nom — pas un extrait.
    expect(isOfficialMvTitle('[MV] 하이라이트(HIGHLIGHT) - Chains').official).toBe(true)
    expect(isOfficialMvTitle('[MV] 하이라이트(HIGHLIGHT) - BODY').official).toBe(true)
  })
})
