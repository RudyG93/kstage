import { describe, expect, it } from 'vitest'
import {
  findDuplicatePersonCandidates,
  findNumberingConflicts,
  isPlaceholderTitle,
  normalizeName,
  type MemberRow,
} from './checks'

describe('isPlaceholderTitle', () => {
  it('matche le titre generique pose par l’ingest debuts', () => {
    expect(isPlaceholderTitle('OURBIRTHDAY debut', 'OURBIRTHDAY')).toBe(true)
    expect(isPlaceholderTitle('ourbirthday Debut', 'OURBIRTHDAY')).toBe(true)
  })
  it('ne matche pas un vrai titre de single', () => {
    expect(isPlaceholderTitle('Candy Shower', 'OURBIRTHDAY')).toBe(false)
    expect(isPlaceholderTitle('OURBIRTHDAY debut single', 'OURBIRTHDAY')).toBe(false)
  })
})

describe('findNumberingConflicts', () => {
  it('flagge le cas reel Music Bank #1294/#1295 (5 episodes entre)', () => {
    const eps = [
      { show_title: 'Music Bank', kst_day: '2026-06-05', episode_number: 1294 },
      { show_title: 'Music Bank', kst_day: '2026-06-12', episode_number: null },
      { show_title: 'Music Bank', kst_day: '2026-06-19', episode_number: null },
      { show_title: 'Music Bank', kst_day: '2026-06-26', episode_number: null },
      { show_title: 'Music Bank', kst_day: '2026-07-03', episode_number: null },
      { show_title: 'Music Bank', kst_day: '2026-07-10', episode_number: null },
      { show_title: 'Music Bank', kst_day: '2026-07-17', episode_number: 1295 },
    ]
    const conflicts = findNumberingConflicts(eps)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toContain('#1294')
    expect(conflicts[0]).toContain('attendu 6')
  })

  it('accepte une sequence hebdo coherente', () => {
    const eps = [
      { show_title: 'Inkigayo', kst_day: '2026-07-05', episode_number: 1316 },
      { show_title: 'Inkigayo', kst_day: '2026-07-12', episode_number: 1317 },
      { show_title: 'Inkigayo', kst_day: '2026-07-19', episode_number: 1318 },
    ]
    expect(findNumberingConflicts(eps)).toHaveLength(0)
  })

  it('accepte des numeros seuls (rien a comparer) et des shows melanges', () => {
    const eps = [
      { show_title: 'The Show', kst_day: '2026-07-14', episode_number: 400 },
      { show_title: 'M Countdown', kst_day: '2026-07-09', episode_number: null },
    ]
    expect(findNumberingConflicts(eps)).toHaveLength(0)
  })
})

const base: Omit<MemberRow, 'id' | 'slug' | 'stage_name' | 'group_id' | 'group_name'> = {
  real_name: null,
  birthday: null,
  canonical_id: null,
}

describe('findDuplicatePersonCandidates', () => {
  it('detecte le cas reel SuA Dreamcatcher/UAU (birthday + stage name, real_name null cote UAU)', () => {
    const rows: MemberRow[] = [
      {
        ...base,
        id: '1',
        slug: 'dreamcatcher-sua',
        stage_name: 'Sua',
        real_name: 'Kim Bora',
        birthday: '1994-08-10',
        group_id: 'g1',
        group_name: 'Dreamcatcher',
      },
      {
        ...base,
        id: '2',
        slug: 'uau-sua',
        stage_name: 'SuA',
        birthday: '1994-08-10',
        group_id: 'g2',
        group_name: 'UAU',
      },
    ]
    const dups = findDuplicatePersonCandidates(rows)
    expect(dups).toHaveLength(1)
    expect(dups[0]).toContain('dreamcatcher-sua')
    expect(dups[0]).toContain('uau-sua')
  })

  it('ne lie JAMAIS sur le stage name seul (Sua MW:MEU ≠ Moon Sua Billlie)', () => {
    const rows: MemberRow[] = [
      {
        ...base,
        id: '1',
        slug: 'mw-meu-sua',
        stage_name: 'Sua',
        group_id: 'g1',
        group_name: 'MW:MEU',
      },
      {
        ...base,
        id: '2',
        slug: 'billlie-moon-sua',
        stage_name: 'Moon Sua',
        group_id: 'g2',
        group_name: 'Billlie',
      },
      {
        ...base,
        id: '3',
        slug: 'dreamcatcher-sua',
        stage_name: 'Sua',
        birthday: '1994-08-10',
        group_id: 'g3',
        group_name: 'Dreamcatcher',
      },
    ]
    expect(findDuplicatePersonCandidates(rows)).toHaveLength(0)
  })

  it('detecte par real_name egal meme si les stage names different', () => {
    const rows: MemberRow[] = [
      {
        ...base,
        id: '1',
        slug: 'a-karina',
        stage_name: 'Karina',
        real_name: 'Yu Ji-min',
        group_id: 'g1',
        group_name: 'A',
      },
      {
        ...base,
        id: '2',
        slug: 'b-jimin',
        stage_name: 'Jimin',
        real_name: 'Yu Jimin',
        group_id: 'g2',
        group_name: 'B',
      },
    ]
    // normalizeName gomme espaces/tirets : « Yu Ji-min » ≡ « Yu Jimin ».
    expect(findDuplicatePersonCandidates(rows)).toHaveLength(1)
  })

  it('ignore les paires deja canonical-liees et les memes groupes', () => {
    const rows: MemberRow[] = [
      {
        ...base,
        id: '1',
        slug: 'dreamcatcher-sua',
        stage_name: 'Sua',
        birthday: '1994-08-10',
        group_id: 'g1',
        group_name: 'Dreamcatcher',
      },
      {
        ...base,
        id: '2',
        slug: 'uau-sua',
        stage_name: 'SuA',
        birthday: '1994-08-10',
        canonical_id: '1',
        group_id: 'g2',
        group_name: 'UAU',
      },
    ]
    expect(findDuplicatePersonCandidates(rows)).toHaveLength(0)
  })
})

describe('normalizeName', () => {
  it('gomme casse, espaces, tirets, apostrophes', () => {
    expect(normalizeName("Kim Bo-ra's")).toBe(normalizeName('kimboras'))
    expect(normalizeName(null)).toBe('')
  })
})
