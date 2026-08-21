import { describe, expect, it } from 'vitest'
import { corroborate, harvestEpisodes, parseAirDate, parseEpisodeNumber } from './broadcast-harvest'
import { STAGE_TITLE_MARKERS } from './stage-links'
import type { UploadItem } from '../youtube'

const upload = (title: string, publishedAt: string): UploadItem => ({
  videoId: title.slice(0, 8),
  title,
  publishedAt,
  description: '',
  thumbnailUrl: '',
})

describe('parseAirDate', () => {
  // Un titre par diffuseur, relevé sur les chaînes officielles le 2026-08-21.
  it.each([
    [
      "'COMEBACK' WayV - Vision Wings #엠카운트다운 EP.942 | Mnet 260820 방송",
      'm-countdown' as const,
      '2026-08-20T12:00:00Z',
      '2026-08-20',
    ],
    [
      "[K-Fancam] 엔하이픈 제이 'Bloody Paradise' @뮤직뱅크(Music Bank) 260821",
      'music-bank' as const,
      '2026-08-21T09:00:00Z',
      '2026-08-21',
    ],
    [
      '[#최애직캠] KiiiKiii KYA – Pop Off Pop Off | 쇼! 음악중심 | MBC260815',
      'music-core' as const,
      '2026-08-18T02:00:00Z',
      '2026-08-15',
    ],
    [
      "[안방1열 풀캠4K] 웨이션브이 'Vision Wings' (WayV FullCam) @SBS Inkigayo 260816",
      'inkigayo' as const,
      '2026-08-16T09:00:00Z',
      '2026-08-16',
    ],
    [
      '[쇼챔직캠 4K] WayV KUN - Vision Wings | Show Champion | EP.608 | 260819',
      'show-champion' as const,
      '2026-08-19T10:00:00Z',
      '2026-08-19',
    ],
    [
      '[JJaeLiView] KISS OF LIFE [THE SHOW] 260811 방송',
      'the-show' as const,
      '2026-08-13T05:00:00Z',
      '2026-08-11',
    ],
  ])('lit %s', (title, show, publishedAt, expected) => {
    expect(parseAirDate(title, show, publishedAt)).toBe(expected)
  })

  it('rejette une date qui ne tombe pas le jour de diffusion du show', () => {
    // 260820 est un jeudi : valide pour M Countdown, jamais pour Music Bank.
    expect(parseAirDate('… | Mnet 260820 방송', 'music-bank', '2026-08-20T12:00:00Z')).toBeNull()
  })

  it('rejette une date trop ancienne pour la publication (compilation)', () => {
    expect(
      parseAirDate('무대 모음 @뮤직뱅크(Music Bank) 260403', 'music-bank', '2026-08-21T09:00:00Z'),
    ).toBeNull()
  })

  it('rejette une date postérieure à la publication de plus de deux jours', () => {
    expect(
      parseAirDate('@뮤직뱅크(Music Bank) 260828', 'music-bank', '2026-08-21T09:00:00Z'),
    ).toBeNull()
  })

  it('ignore un nombre à six chiffres qui ne peut pas être une date', () => {
    expect(
      parseAirDate('조회수 991350 @뮤직뱅크(Music Bank)', 'music-bank', '2026-08-21T09:00:00Z'),
    ).toBeNull()
  })
})

describe('parseEpisodeNumber', () => {
  it('lit le numéro annoncé par Mnet et Show Champion', () => {
    expect(parseEpisodeNumber('… #엠카운트다운 EP.942 | Mnet 260820 방송', 'm-countdown')).toBe(942)
    expect(parseEpisodeNumber('… | Show Champion | EP.608 | 260819', 'show-champion')).toBe(608)
  })

  it("n'invente aucun numéro pour les shows dont le format n'est pas vérifié", () => {
    // KBS poste « 리무진서비스 … EP.230 » sur la chaîne de Music Bank : le
    // numéro appartient à une AUTRE émission.
    expect(
      parseEpisodeNumber('[리무진서비스] … | EP.230 @뮤직뱅크 260821', 'music-bank'),
    ).toBeNull()
  })
})

describe('corroborate', () => {
  it('exige deux occurrences concordantes', () => {
    expect(corroborate([942])).toBeNull()
    expect(corroborate([942, 942])).toBe(942)
  })

  it('écarte une coquille isolée au profit de la majorité', () => {
    expect(corroborate([942, 942, 924])).toBe(942)
  })

  it('ne tranche pas une égalité', () => {
    expect(corroborate([942, 924])).toBeNull()
  })
})

describe('harvestEpisodes', () => {
  const marker = STAGE_TITLE_MARKERS['m-countdown']

  it('groupe par diffusion et corrobore le numéro', () => {
    const eps = harvestEpisodes(
      [
        upload(
          "'COMEBACK' WayV - A #엠카운트다운 EP.942 | Mnet 260820 방송",
          '2026-08-20T11:00:00Z',
        ),
        upload(
          "'COMEBACK' AtHeart - B #엠카운트다운 EP.942 | Mnet 260820 방송",
          '2026-08-20T11:05:00Z',
        ),
        upload('CORTIS - C #엠카운트다운 EP.941 | Mnet 260813 방송', '2026-08-13T11:00:00Z'),
      ],
      'm-countdown',
      marker,
    )
    expect(eps.map((e) => [e.kstDay, e.episodeNumber, e.videos.length])).toEqual([
      ['2026-08-13', null, 1],
      ['2026-08-20', 942, 2],
    ])
  })

  it('ignore une vidéo sans marqueur de show ou sans date de diffusion', () => {
    expect(
      harvestEpisodes(
        [
          upload('[#SDF] 시그니처 안무 쟁탈전 | 인규 vs 바다', '2026-08-21T09:00:00Z'),
          upload('PLAVE 2024 무대 모음 #엠카운트다운', '2026-08-20T09:00:00Z'),
        ],
        'm-countdown',
        marker,
      ),
    ).toEqual([])
  })
})
