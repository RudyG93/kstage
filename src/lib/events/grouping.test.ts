import { describe, it, expect } from 'vitest'
import {
  clusterByGroup,
  splitUpcomingByWeek,
  splitUpcomingByBuckets,
  capLaterEvents,
  groupMusicShowEpisodes,
  lineupLabel,
} from './grouping'
import type { UpcomingEvent } from './queries'

const ev = (id: string, start_at: string) => ({ id, start_at }) as unknown as UpcomingEvent

// Fixture music_show réaliste (paires prod : Music Bank 2026-07-10, 5 groupes,
// même title/start_at/source carrd — cf. JOURNAL 2026-07-05).
const show = (
  id: string,
  groupName: string,
  {
    title = 'Music Bank',
    start_at = '2026-07-10T08:00:00Z',
    source_url = 'https://liveshowupdatess.carrd.co/',
    stage_url = null as string | null,
    episode_number = null as number | null,
    type = 'music_show',
    slug = null as string | null,
  } = {},
) =>
  ({
    id,
    group_id: `gid-${groupName.toLowerCase()}`,
    type,
    title,
    start_at,
    source_url,
    stage_url,
    episode_number,
    slug,
    groups: { slug: groupName.toLowerCase(), name: groupName },
  }) as unknown as UpcomingEvent

describe('groupMusicShowEpisodes', () => {
  it('fusionne un épisode à 5 groupes en 1 carte avec lineup (cas prod 2026-07-10)', () => {
    const events = ['ATEEZ', 'Hearts2Hearts', 'izna', 'MEOVV', 'RIIZE'].map((g, i) =>
      show(`e${i}`, g),
    )
    const grouped = groupMusicShowEpisodes(events)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].id).toBe('e0') // représentant = 1re occurrence
    expect(grouped[0].lineup?.map((e) => e.groups?.name)).toEqual([
      'ATEEZ',
      'Hearts2Hearts',
      'izna',
      'MEOVV',
      'RIIZE',
    ])
  })

  it('post-enrichissement mixte : les lignes avec stage_url restent individuelles', () => {
    const events = [
      show('a', 'ATEEZ', { stage_url: 'https://www.youtube.com/watch?v=abc' }),
      show('b', 'Hearts2Hearts'),
      show('c', 'izna', { stage_url: 'https://youtu.be/def' }),
      show('d', 'MEOVV'),
      show('e', 'RIIZE'),
    ]
    const grouped = groupMusicShowEpisodes(events)
    // 2 individuelles (stages enrichis) + 1 groupée de 3 (carrd redondant).
    expect(grouped).toHaveLength(3)
    expect(grouped.find((e) => e.id === 'a')?.lineup).toBeUndefined()
    expect(grouped.find((e) => e.id === 'c')?.lineup).toBeUndefined()
    expect(grouped.find((e) => e.id === 'b')?.lineup?.map((e) => e.id)).toEqual(['b', 'd', 'e'])
  })

  it('episode_number : premier non-null du lineup exposé sur le représentant', () => {
    const events = [
      show('a', 'ATEEZ'),
      show('b', 'RIIZE', { episode_number: 328 }),
      show('c', 'izna'),
    ]
    const [rep] = groupMusicShowEpisodes(events)
    expect(rep.episode_number).toBe(328)
  })

  it('pass-through : seuls les music_show fusionnent, tri global intact', () => {
    const events = [
      show('mv1', 'aespa', {
        type: 'mv',
        title: 'Whiplash',
        start_at: '2026-07-09T09:00:00Z',
        slug: 'whiplash',
      }),
      show('mb1', 'ATEEZ'),
      show('mb2', 'RIIZE'),
      show('anniv', 'ILLIT', {
        type: 'anniversary',
        title: 'Debut day',
        start_at: '2026-07-11T00:00:00Z',
      }),
      show('ink1', 'aespa', { title: 'Inkigayo', start_at: '2026-07-12T06:50:00Z' }),
      show('ink2', 'izna', { title: 'Inkigayo', start_at: '2026-07-12T06:50:00Z' }),
    ]
    const grouped = groupMusicShowEpisodes(events)
    expect(grouped.map((e) => e.id)).toEqual(['mv1', 'mb1', 'anniv', 'ink1'])
    expect(grouped.find((e) => e.id === 'mb1')?.lineup).toHaveLength(2)
    expect(grouped.find((e) => e.id === 'ink1')?.lineup).toHaveLength(2)
    expect(grouped.find((e) => e.id === 'mv1')?.lineup).toBeUndefined()
  })

  it('doublon DB par (groupe, épisode) : la row enrichie gagne (défense en profondeur)', () => {
    // Régression historique (prod 2026-07-02, corrigée par la migration 0039) :
    // chaque groupe avait une row carrd ET une row enrichie pour le même
    // épisode. La dédup display-level est conservée en garde-fou.
    const events = [
      show('a-carrd', 'ATEEZ'),
      show('a-stage', 'ATEEZ', { stage_url: 'https://www.youtube.com/watch?v=abc' }),
      show('b-stage', 'RIIZE', { stage_url: 'https://www.youtube.com/watch?v=def' }),
      show('b-carrd', 'RIIZE'),
    ]
    const grouped = groupMusicShowEpisodes(events)
    // 2 cartes stage individuelles, AUCUNE carte carrd fusionnée résiduelle.
    expect(grouped.map((e) => e.id).sort()).toEqual(['a-stage', 'b-stage'])
    expect(grouped.every((e) => !e.lineup)).toBe(true)
  })

  it('singleton : pas de champ lineup → rendu identique à aujourd’hui', () => {
    const [rep] = groupMusicShowEpisodes([show('solo', 'ATEEZ')])
    expect(rep.lineup).toBeUndefined()
    expect(rep.id).toBe('solo')
  })

  it('liste vide → liste vide', () => {
    expect(groupMusicShowEpisodes([])).toEqual([])
  })
})

describe('lineupLabel', () => {
  it('1 nom → tel quel', () => {
    expect(lineupLabel(['ATEEZ'])).toBe('ATEEZ')
  })
  it('3 noms → liste complète sans suffixe', () => {
    expect(lineupLabel(['ATEEZ', 'RIIZE', 'izna'])).toBe('ATEEZ, RIIZE, izna')
  })
  it('5 noms → 3 listés & 2 more', () => {
    expect(lineupLabel(['ATEEZ', 'RIIZE', 'izna', 'MEOVV', 'Hearts2Hearts'])).toBe(
      'ATEEZ, RIIZE, izna & 2 more',
    )
  })
})

describe('splitUpcomingByWeek', () => {
  const now = new Date('2026-06-01T00:00:00Z').getTime()

  it('range ≤ 7 jours dans thisWeek, le reste dans later', () => {
    const events = [
      ev('a', '2026-06-02T00:00:00Z'), // J+1
      ev('b', '2026-06-08T00:00:00Z'), // J+7 (limite incluse)
      ev('c', '2026-06-20T00:00:00Z'), // J+19
    ]
    const { thisWeek, later } = splitUpcomingByWeek(events, now)
    expect(thisWeek.map((e) => e.id)).toEqual(['a', 'b'])
    expect(later.map((e) => e.id)).toEqual(['c'])
  })

  it('liste vide → deux buckets vides', () => {
    expect(splitUpcomingByWeek([], now)).toEqual({ thisWeek: [], later: [] })
  })
})

describe('splitUpcomingByBuckets', () => {
  // 2026-06-01T00:00:00Z = 2026-06-01T09:00:00 KST
  // kstDayKey(now) = '2026-06-01'
  const now = new Date('2026-06-01T00:00:00Z').getTime()

  it('liste vide → 4 buckets vides', () => {
    expect(splitUpcomingByBuckets([], now)).toEqual({
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
    })
  })

  it("event à 23h KST aujourd'hui reste dans today (pas tomorrow)", () => {
    // 2026-06-01T14:00:00Z = 2026-06-01T23:00:00 KST
    const events = [ev('a', '2026-06-01T14:00:00Z')]
    const { today, tomorrow } = splitUpcomingByBuckets(events, now)
    expect(today.map((e) => e.id)).toEqual(['a'])
    expect(tomorrow).toEqual([])
  })

  it('event J+1 KST classé dans tomorrow', () => {
    // 2026-06-02T03:00:00Z = 2026-06-02T12:00:00 KST → tomorrow
    const events = [ev('a', '2026-06-02T03:00:00Z')]
    const { tomorrow } = splitUpcomingByBuckets(events, now)
    expect(tomorrow.map((e) => e.id)).toEqual(['a'])
  })

  it('events J+2 à J+7 KST dans thisWeek (J+7 inclus)', () => {
    const events = [
      ev('a', '2026-06-03T05:00:00Z'), // 2026-06-03 14:00 KST
      ev('b', '2026-06-08T14:00:00Z'), // 2026-06-08 23:00 KST → kstDayKey = 2026-06-08, weekEndKey = 2026-06-08
    ]
    const { thisWeek } = splitUpcomingByBuckets(events, now)
    expect(thisWeek.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('event J+8 KST classé dans later', () => {
    // 2026-06-09T14:00:00Z = 2026-06-09 23:00 KST → later
    const events = [ev('a', '2026-06-09T14:00:00Z')]
    const { later } = splitUpcomingByBuckets(events, now)
    expect(later.map((e) => e.id)).toEqual(['a'])
  })

  it('mix complet réparti correctement', () => {
    const events = [
      ev('today1', '2026-06-01T05:00:00Z'), // today
      ev('today2', '2026-06-01T14:00:00Z'), // today
      ev('tom', '2026-06-02T10:00:00Z'), // tomorrow
      ev('week1', '2026-06-04T10:00:00Z'), // this week
      ev('week2', '2026-06-08T10:00:00Z'), // this week (limit J+7)
      ev('later1', '2026-06-20T10:00:00Z'), // later
    ]
    const { today, tomorrow, thisWeek, later } = splitUpcomingByBuckets(events, now)
    expect(today.map((e) => e.id)).toEqual(['today1', 'today2'])
    expect(tomorrow.map((e) => e.id)).toEqual(['tom'])
    expect(thisWeek.map((e) => e.id)).toEqual(['week1', 'week2'])
    expect(later.map((e) => e.id)).toEqual(['later1'])
  })
})

describe('capLaterEvents (§3.1)', () => {
  const now = new Date('2026-06-01T00:00:00Z').getTime() // limite J+35 ≈ 2026-07-06

  it('borne à ≤10 events dans la fenêtre et ne compte que l’overflow interne', () => {
    const within = Array.from({ length: 12 }, (_, i) =>
      ev(`w${i}`, `2026-06-${String(i + 2).padStart(2, '0')}T03:00:00Z`),
    ) // 2..13 juin, tous dans la fenêtre
    const beyond = [ev('b1', '2026-08-01T03:00:00Z')] // > J+35 → hors feed, non compté
    const { display, moreCount, moreHref } = capLaterEvents(
      [...within, ...beyond],
      now,
      'Asia/Seoul',
    )
    expect(display).toHaveLength(10)
    expect(moreCount).toBe(2) // 12 dans la fenêtre - 10 affichés (l'event d'août non compté)
    expect(moreHref).toMatch(/^\/calendar\?month=\d{4}-\d{2}&day=\d{4}-\d{2}-\d{2}$/)
  })

  it('exclut du feed (display ET moreCount) les events au-delà de la fenêtre', () => {
    const { display, moreCount } = capLaterEvents([ev('b', '2026-08-01T03:00:00Z')], now)
    expect(display).toEqual([])
    expect(moreCount).toBe(0)
  })

  it('liste vide → display vide, pas de lien', () => {
    expect(capLaterEvents([], 0)).toEqual({ display: [], moreCount: 0, moreHref: null })
  })
})

describe('splitUpcomingByBuckets — fuseau utilisateur (§1.3)', () => {
  // now = 2026-05-30T15:00:00Z
  //   Europe/Paris (UTC+2, CEST) → 17:00 le 30 mai → today = 2026-05-30
  //   Asia/Seoul   (UTC+9)       → 00:00 le 31 mai → today = 2026-05-31
  const now = new Date('2026-05-30T15:00:00Z').getTime()
  // event = 2026-05-31T13:00:00Z
  //   Paris → 15:00 le 31 mai → J+1 pour l'utilisateur parisien (tomorrow)
  //   Seoul → 22:00 le 31 mai → même jour que `now` en KST
  const event = ev('e', '2026-05-31T13:00:00Z')

  it('classe en tomorrow dans le fuseau de l’utilisateur (Europe/Paris)', () => {
    const { today, tomorrow } = splitUpcomingByBuckets([event], now, 'Europe/Paris')
    expect(today).toEqual([])
    expect(tomorrow.map((e) => e.id)).toEqual(['e'])
  })

  it('reproduit le bug historique : en KST le même event tombe à tort dans today', () => {
    const { today } = splitUpcomingByBuckets([event], now, 'Asia/Seoul')
    expect(today.map((e) => e.id)).toEqual(['e'])
  })

  it('fuseau par défaut = Asia/Seoul (compat ascendante)', () => {
    expect(splitUpcomingByBuckets([event], now)).toEqual(
      splitUpcomingByBuckets([event], now, 'Asia/Seoul'),
    )
  })
})

describe('time-shift carrd (fix 2026-07-12)', () => {
  it('même épisode à deux heures du même jour KST → une seule carte', () => {
    // Cas prod réel : Music Core 954 du 11/07, carrd passé de 15:15 à 15:20 KST
    // → 2 rows par groupe. La fusion par jour KST n'en montre qu'une.
    const events = [
      show('a-1515', 'i-dle', { title: 'Music Core', start_at: '2026-07-11T06:15:00Z' }),
      show('a-1520', 'i-dle', { title: 'Music Core', start_at: '2026-07-11T06:20:00Z' }),
      show('b-1515', 'BABYMONSTER', { title: 'Music Core', start_at: '2026-07-11T06:15:00Z' }),
      show('b-1520', 'BABYMONSTER', { title: 'Music Core', start_at: '2026-07-11T06:20:00Z' }),
    ]
    const grouped = groupMusicShowEpisodes(events)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].lineup).toHaveLength(2) // un par groupe, pas quatre
  })
})

describe('clusterByGroup (R6)', () => {
  const e = (id: string, group: string, at: string) => ({
    id,
    group_id: group,
    start_at: at,
    groups: { name: group },
  })
  it("rapproche les events d'un même groupe, ancrés au premier, ordre stable sinon", () => {
    const day = [
      e('a', 'youngposse', '2026-07-13T00:00:00Z'),
      e('b', 'dailydirection', '2026-07-13T09:00:00Z'),
      e('c', 'youngposse', '2026-07-13T12:00:00Z'),
      e('d', 'qwer', '2026-07-13T15:00:00Z'),
    ]
    expect(clusterByGroup(day).map((x) => x.id)).toEqual(['a', 'c', 'b', 'd'])
  })
  it('sans doublon de groupe : ordre inchangé', () => {
    const day = [e('a', 'g1', '1'), e('b', 'g2', '2')]
    expect(clusterByGroup(day).map((x) => x.id)).toEqual(['a', 'b'])
  })
})
