import { describe, it, expect } from 'vitest'
import { rankStageCandidates, showIdFromTitle } from './stage-links'
import type { UploadItem } from '../youtube'

const upload = (over: Partial<UploadItem>): UploadItem => ({
  videoId: 'x'.repeat(11),
  title: '',
  description: '',
  publishedAt: '2026-07-03T10:00:00Z',
  thumbnailUrl: null,
  ...over,
})

// Diffusion : Music Bank vendredi 17:15 KST = 08:15 UTC.
const AIR = '2026-07-03T08:15:00Z'

describe('showIdFromTitle', () => {
  it('mappe les displayName DB vers les ShowId', () => {
    expect(showIdFromTitle('Music Bank')).toBe('music-bank')
    expect(showIdFromTitle('M Countdown')).toBe('m-countdown')
    expect(showIdFromTitle('Unknown Show')).toBe(null)
  })
})

describe('rankStageCandidates', () => {
  it('matche la vidéo du passage (format titre réel KBS Kpop)', () => {
    const uploads = [
      upload({
        videoId: 'abc12345678',
        title: 'Do your dance - RIIZE [뮤직뱅크/Music Bank] | KBS 260703 방송',
        publishedAt: '2026-07-03T12:00:00Z',
      }),
    ]
    expect(rankStageCandidates(uploads, 'RIIZE', 'music-bank', AIR)[0]?.videoId).toBe('abc12345678')
  })

  it('vrai stage retenu, clip à caption émotionnelle exclu — faux positif réel Mnet du run 1', () => {
    const air = '2026-07-02T09:00:00Z' // M Countdown jeudi 18:00 KST
    const uploads = [
      // Clip dérivé posté en premier : caption émotionnelle, hashtags seulement → score 0.
      upload({
        videoId: 'derivclip01',
        title: '헤메코 미친 라이즈 보고 어떻게 잘자...? #MCOUNTDOWN #엠카운트다운 #RIIZE',
        publishedAt: '2026-07-02T10:00:00Z',
      }),
      // Le vrai passage : marqueur EP + format « Group - Song ».
      upload({
        videoId: 'realstage01',
        title: 'RIIZE (라이즈) - Fame | M COUNTDOWN EP.935 | Mnet 260702 방송',
        publishedAt: '2026-07-02T11:00:00Z',
      }),
    ]
    const ranked = rankStageCandidates(uploads, 'RIIZE', 'm-countdown', air)
    expect(ranked.map((u) => u.videoId)).toEqual(['realstage01'])
  })

  it('exclut un segment variety multi-artistes — faux positif réel « M-Z » du run 2', () => {
    const air = '2026-07-02T09:00:00Z'
    const uploads = [
      upload({
        videoId: 'varietyclip',
        title:
          "'엠카드림' 오늘의 M-Z니 HYUNHAYO of TREASURE, RIIZE, Hearts2Hearts #엠카운트다운 EP.935 | Mnet 260702 방송",
        publishedAt: '2026-07-02T12:00:00Z',
      }),
    ]
    // Matche RIIZE mais aussi Hearts2Hearts/TREASURE → malus multi-artistes,
    // sous le seuil : rien à lier (repli page groupe, mieux qu'un mauvais lien).
    const ranked = rankStageCandidates(uploads, 'RIIZE', 'm-countdown', air, [
      'RIIZE',
      'Hearts2Hearts',
      'TREASURE',
    ])
    expect(ranked).toHaveLength(0)
  })

  it("rejette une vidéo d'un autre show sur la même chaîne", () => {
    const uploads = [
      upload({ title: '[더 시즌즈] aespa full ver.', publishedAt: '2026-07-03T12:00:00Z' }),
    ]
    expect(rankStageCandidates(uploads, 'aespa', 'music-bank', AIR)).toHaveLength(0)
  })

  it("rejette le passage d'un autre groupe", () => {
    const uploads = [
      upload({
        title: '[Music Bank] Supernova - IVE 20260703',
        publishedAt: '2026-07-03T12:00:00Z',
      }),
    ]
    expect(rankStageCandidates(uploads, 'aespa', 'music-bank', AIR)).toHaveLength(0)
  })

  it('rejette hors fenêtre de diffusion (la semaine précédente)', () => {
    const uploads = [
      upload({
        title: '[Music Bank] Whiplash - aespa 20260626',
        publishedAt: '2026-06-26T12:00:00Z',
      }),
    ]
    expect(rankStageCandidates(uploads, 'aespa', 'music-bank', AIR)).toHaveLength(0)
  })

  it('accepte un upload quelques jours après diffusion (J+3)', () => {
    const uploads = [
      upload({
        videoId: 'late1234567',
        title: '[MUSIC BANK] aespa - Whiplash (4K)',
        publishedAt: '2026-07-06T09:00:00Z',
      }),
    ]
    expect(rankStageCandidates(uploads, 'aespa', 'music-bank', AIR)[0]?.videoId).toBe('late1234567')
  })
})

describe('rankStageCandidates — format SBS sans nom de show (2026-07-13)', () => {
  // Inkigayo 12/07 : les 3 stages existaient sur @sbskpop mais le titre ne
  // porte plus « Inkigayo » — « Song - Group | SBS 260712 방송 ». Le marqueur
  // accepte désormais « SBS <YYMMDD> 방송 ».
  const AIR_INKI = '2026-07-12T06:10:00Z'
  it('matche le nouveau format « | SBS YYMMDD 방송 »', () => {
    const uploads = [
      upload({
        videoId: 'inki1234567',
        title: 'Gimme Dat Love - i-dle (아이들) | SBS 260712 방송',
        publishedAt: '2026-07-12T10:00:00Z',
      }),
    ]
    const ranked = rankStageCandidates(uploads, 'i-dle', 'inkigayo', AIR_INKI)
    expect(ranked.map((u) => u.videoId)).toEqual(['inki1234567'])
  })
  it('ne matche pas la FullCam 4K (score 0, pas un stage broadcast)', () => {
    const uploads = [
      upload({
        videoId: 'full1234567',
        title: "[안방1열 풀캠4K] 아이들 'Gimme Dat Love' (i-dle FullCam) @SBS Inkigayo 260712",
        publishedAt: '2026-07-12T11:00:00Z',
      }),
    ]
    expect(rankStageCandidates(uploads, 'i-dle', 'inkigayo', AIR_INKI)).toEqual([])
  })
})

describe('rankStageCandidates — contenus non-stage (2026-07-11)', () => {
  const AIR_MCD = '2026-07-09T09:00:00Z'
  it("rejette l'interview de comeback (faux positif réel EP.936) et garde le vrai stage", () => {
    const uploads = [
      upload({
        videoId: 'interview01',
        title: "'컴백 인터뷰' i-dle (아이들) #엠카운트다운 EP.936 | Mnet 260709 방송",
        publishedAt: '2026-07-09T11:00:00Z',
      }),
      upload({
        videoId: 'realstage01',
        title: "'Good Thing' i-dle (아이들) #엠카운트다운 EP.936 | Mnet 260709 방송",
        publishedAt: '2026-07-09T11:05:00Z',
      }),
    ]
    const ranked = rankStageCandidates(uploads, 'i-dle', 'm-countdown', AIR_MCD)
    expect(ranked.map((u) => u.videoId)).toEqual(['realstage01'])
  })
  it('rejette behind/fancam/making même avec marqueurs de diffusion', () => {
    for (const title of [
      '[BEHIND] i-dle 비하인드 #엠카운트다운 EP.936 | Mnet 방송',
      'i-dle 직캠 (fancam) #엠카운트다운 EP.936 방송',
      'i-dle MAKING FILM #엠카운트다운 EP.936 방송',
    ]) {
      const ranked = rankStageCandidates(
        [upload({ videoId: 'x9999999999', title, publishedAt: '2026-07-09T11:00:00Z' })],
        'i-dle',
        'm-countdown',
        AIR_MCD,
      )
      expect(ranked).toHaveLength(0)
    }
  })
})
