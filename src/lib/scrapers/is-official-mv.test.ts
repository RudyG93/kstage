import { describe, it, expect } from 'vitest'
import { destylize, isOfficialMvTitle } from './is-official-mv'

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
    // R8 : vrais MVs à NE PAS attraper par les nouvelles règles.
    // « 10억뷰 » est le NOM de la chanson (억뷰 seul, sans 돌파/달성) → garde.
    "EXO-SC 세훈&찬열 '10억뷰 (1 Billion Views) (Feat. MOON)' MV",
    // ♡ (dans le nom de chanson) — l'ancienne piste « emoji brut » l'aurait cassé.
    "TXT (투모로우바이투게더) 'LO$ER=LO♡ER' Official MV",
    // ® (F1® The Movie) — idem.
    'ROSÉ - Messy (From F1® The Movie) [Official Music Video]',
  ]
  const notOfficial: [string, string][] = [
    ["aespa 'Whiplash' MV Teaser", 'blacklist:teaser'],
    ["ILLIT 'Magnetic' Lyric Video", 'blacklist:lyric'],
    // La blacklist prime sur le nouveau marqueur « official video ».
    ["ROSÉ - 'toxic' (Official Lyric Video)", 'blacklist:lyric'],
    ["BABYMONSTER 'SHEESH' DANCE PRACTICE", 'blacklist:dance practice'],
    ["(G)I-DLE 'TOMBOY' Live Clip", 'blacklist:live'],
    ["NewJeans 'Supernatural' (Official Audio)", 'blacklist:audio'],
    ["aespa 'LEMONADE' Behind the scenes", 'blacklist:behind'],
    ["ILLIT 'Magnetic' M/V Making Film", 'blacklist:making'],
    ['(G)I-DLE - M/V Bloopers : [I feel]', 'blacklist:bloopers'],
    ["(G)I-DLE - 'Uh-Oh' M/V 응원법", 'blacklist:fanchant'],
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
    // ---- R8 : contenu/vlog sur chaîne officielle avec « MV » (ARTMS…). ----
    ['MV 속 Club Icarus 서울에 실존! 🪽✨ | EN JP CN | ARTMS', 'blacklist:content subtitles'],
    [
      'Virtual Angel MV를 n회차 시청해야하는 이유! | EN JP CN | ARTMS',
      'blacklist:content subtitles',
    ],
    ["[BANGTAN BOMB] Dance Battle during 'IDOL' MV shoot - BTS", 'blacklist:mv shoot'],
    ["[Let's Play MCND] MCND - Hey You M/V", "blacklist:let's play"],
    ['🎬DD MV TIME🤷‍♂️ #DAILYDIRECTION #DD', 'blacklist:mv time'],
    ["TRI.BE(트라이비) 'RUB-A-DUM' MV 1,000만뷰 돌파🎉🎉", 'blacklist:view milestone'],
    ['(SUB) Apink-log | 은지 | MV메이크업💄', 'blacklist:makeup vlog'],
    ['TRI.BE - Papa Noel Funniest MV ⛄', 'blacklist:funniest'],
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

// Formats de clip officiels mais secondaires (retour Rudy 2026-08-21) :
// certaines chansons n'ont QUE ça comme visuel officiel — les jeter les faisait
// disparaître de l'app. Titres réels des chaînes officielles.
describe('isOfficialMvTitle — Performance / Special Video', () => {
  it('accepte un Performance Video en le marquant secondaire', () => {
    const r = isOfficialMvTitle('OURBIRTHDAY "HUNGRY (Side A)" Performance Video')
    expect(r.official).toBe(true)
    expect(r.secondary).toBe(true)
  })

  it('accepte un Special Video en le marquant secondaire', () => {
    const r = isOfficialMvTitle("KISS OF LIFE (키스오브라이프) 'Painting' Special Video")
    expect(r.official).toBe(true)
    expect(r.secondary).toBe(true)
  })

  it('rejette toujours leurs DÉRIVÉS', () => {
    expect(isOfficialMvTitle('"HUNGRY" Performance Video Behind | OBDO').official).toBe(false)
    expect(
      isOfficialMvTitle("KISS OF LIFE 'Don't mind me' Special Video Shoot Sketch").official,
    ).toBe(false)
    expect(isOfficialMvTitle("KISS OF LIFE 'Lucky' Special Video Teaser").official).toBe(false)
  })

  it('un vrai MV reste principal (non secondaire)', () => {
    const r = isOfficialMvTitle("aespa 에스파 'Whiplash' MV")
    expect(r.official).toBe(true)
    expect(r.secondary).toBeUndefined()
  })

  it('les autres dérivés restent rejetés', () => {
    expect(isOfficialMvTitle('BTS "Butter" Dance Practice').official).toBe(false)
    expect(isOfficialMvTitle("ITZY 'Cake' MV Teaser").official).toBe(false)
  })
})

describe('destylize — lettres remplacées par de la ponctuation', () => {
  it('rend « Beh!nd » lisible par la règle behind', () => {
    // Cas signalé par Rudy le 2026-08-21 : publié comme un vrai clip parce que
    // le « i » de Behind est un « ! » — 7 rows Hi-Fi Un!corn en prod.
    const t =
      '[Beh!nd Un!corn] Hi-Fi Un!corn - #14 FANTASIA photo shooting & PHANTOM PAIN MV shooting'
    expect(destylize(t)).toContain('Behind')
    expect(isOfficialMvTitle(t).official).toBe(false)
    expect(isOfficialMvTitle(t).reason).toBe('blacklist:behind')
  })

  it("n'écarte pas un vrai clip dont le nom est stylisé", () => {
    expect(isOfficialMvTitle("Hi-Fi Un!corn (하이파이 유니콘) 'PHANTOM PAIN' MV").official).toBe(
      true,
    )
    expect(isOfficialMvTitle("Kep1er 케플러 | 'Shooting Star' M/V").official).toBe(true)
    expect(isOfficialMvTitle("TXT 'LO$ER=LO♡ER' Official MV").official).toBe(true)
  })
})

describe('dérivés trouvés à l’audit des 3 047 MV en base (2026-08-21)', () => {
  const derives = [
    "[BANGTAN BOMB] 'FIRE' MV Shooting- 'JIMIN' Follow ver. - BTS (방탄소년단)",
    "ENHYPEN (엔하이픈) X TAYO - 'Hey Tayo' MV shooting sketch",
    'TWICE "Feel Special" M/V Monitoring Clip #8',
    "NewJeans (뉴진스) 'Bubble Gum' MV Review",
    'iKON - "PANORAMA" MV Interview',
    "STAYC(스테이씨) 'GPT' MV Synopsis & Inst. Pre-release",
    '[EN-TER key] What Goes On at the MV Set - ENHYPEN (엔하이픈)',
    "IVE 아이브 'ELEVEN' MV EXTRA CUT",
    "ZEROBASEONE (제로베이스원) 'NOW OR NEVER' MV BONUS CUT",
    'ASTRO 아스트로 - Baby M/V QUIZ EVENT',
    '[aespa X Premiere Pro] 프리미어 프로로 만드는 나만의 Girls MV 콘테스트',
    "[특별기획] … | 'It's Me' MV 미니 다큐멘터리 | ILLIT (아일릿)",
    "[Dreamcatcher's Note] '날아올라' 첫 MV 시사!",
    "(MAMAMOO)이니시아네스트'GirlCrush'MV MAKINGFILM",
    "[&DAY] 'Under the skin' MV release Countdown - &TEAM",
    'TWICE "Feel Special" M/V COPY',
    'Jackson Wang - Cruel (MV Demo)',
    'K.A.R.D - Don`t Recall M/V Theory',
  ]
  it.each(derives)('rejette %s', (title) => {
    expect(isOfficialMvTitle(title).official).toBe(false)
  })

  const vraisClips = [
    // Le mot piégeux est dans le TITRE DE LA CHANSON, pas accolé à « MV ».
    'Kep1er 케플러 | ‘Shooting Star’ M/V',
    'XG - SHOOTING STAR (Official Music Video)',
    'DAY6 "Shoot Me" M/V',
    "MONSTA X 몬스타엑스 'Shoot Out' MV",
    "SHINee 샤이니 'View' MV",
    // Ordre inversé « Music Video Official » : Apink titre ainsi ses clips.
    'Apink 에이핑크 덤더럼(Dumhdurum) Music Video Official',
    // Clip auto-produit par le groupe : une version, pas du contenu.
    "VERIVERY - '소중력' DIY M/V (Produced by VERIVERY)",
    // Versions officielles : elles restent des clips.
    'N.Flying (엔플라잉) – 봄이 부시게 (Spring Memories) M/V Selfie ver.',
    'iKON - "PANORAMA" MV Drama Ver',
  ]
  it.each(vraisClips)('garde %s', (title) => {
    expect(isOfficialMvTitle(title).official).toBe(true)
  })
})
