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
