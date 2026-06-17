import { describe, it, expect } from 'vitest'
import { extractVerContent, detectMvVersion, type MemberRef } from './mv-version'

const ILLIT: MemberRef[] = [
  { id: 'iroha-id', stage_name: 'Iroha' },
  { id: 'minju-id', stage_name: 'Minju' },
  { id: 'moka-id', stage_name: 'Moka' },
  { id: 'wonhee-id', stage_name: 'Wonhee' },
  { id: 'youngseo-id', stage_name: 'Youngseo' },
  { id: 'yunah-id', stage_name: 'Yunah' },
]

const AESPA: MemberRef[] = [
  { id: 'karina-id', stage_name: 'Karina' },
  { id: 'winter-id', stage_name: 'Winter' },
  { id: 'giselle-id', stage_name: 'Giselle' },
  { id: 'ningning-id', stage_name: 'Ningning' },
]

describe('extractVerContent', () => {
  it('attrape la paire (... ver.) basique', () => {
    expect(extractVerContent("aespa 'Armageddon' MV (Performance Ver.)")).toBe('Performance Ver.')
  })

  it('prend la dernière paire avec ver quand plusieurs parens', () => {
    expect(
      extractVerContent("[STATION] aespa '시대유감 (時代遺憾) (2024 aespa Remake Ver.)' MV"),
    ).toBe('2024 aespa Remake Ver.')
  })

  it('renvoie null si pas de "ver" dans une paire', () => {
    expect(extractVerContent("aespa 'Whiplash' Official MV")).toBeNull()
    expect(extractVerContent("(여자)아이들 - 'Klaxon' Official Music Video")).toBeNull()
  })

  it('ignore le mot ver. hors parens', () => {
    expect(extractVerContent('Some title ver. final')).toBeNull()
  })
})

describe('detectMvVersion', () => {
  it('main quand pas de version', () => {
    expect(detectMvVersion("aespa 'Whiplash' Official MV", AESPA)).toEqual({
      kind: 'main',
      memberId: null,
    })
  })

  it('solo de membre en tête de titre (chaîne du groupe) → member', () => {
    expect(detectMvVersion("KARINA (카리나) - 'Up' Official MV", AESPA, 'aespa')).toEqual({
      kind: 'member',
      memberId: 'karina-id',
    })
  })

  it('MV de groupe reste main même avec groupName fourni', () => {
    expect(detectMvVersion("aespa 'Whiplash' Official MV", AESPA, 'aespa')).toEqual({
      kind: 'main',
      memberId: null,
    })
  })

  it('performance — Performance Ver.', () => {
    expect(detectMvVersion("aespa 'Armageddon' MV (Performance Ver.)", AESPA)).toEqual({
      kind: 'performance',
      memberId: null,
    })
  })

  it('performance — Dance Ver.', () => {
    expect(detectMvVersion("Group 'X' MV (Dance Ver.)", [])).toEqual({
      kind: 'performance',
      memberId: null,
    })
  })

  it('performance — Choreography Ver.', () => {
    expect(detectMvVersion("Group 'X' MV (Choreography Ver.)", [])).toEqual({
      kind: 'performance',
      memberId: null,
    })
  })

  it('performance — case-insensitive (performance ver., PERFORMANCE Ver)', () => {
    expect(detectMvVersion("ILLIT 'It’s Me’ Official MV (Performance ver.)", ILLIT)).toMatchObject({
      kind: 'performance',
    })
    expect(detectMvVersion("aespa 'X' MV (PERFORMANCE Ver.)", AESPA)).toMatchObject({
      kind: 'performance',
    })
  })

  it('member — MOKA ver.', () => {
    expect(detectMvVersion("ILLIT (아일릿) 'It’s Me’ Official MV (MOKA ver.)", ILLIT)).toEqual({
      kind: 'member',
      memberId: 'moka-id',
    })
  })

  it('member — WONHEE ver. (case-insensitive vs Wonhee)', () => {
    expect(detectMvVersion("ILLIT 'It’s Me’ Official MV (WONHEE ver.)", ILLIT)).toEqual({
      kind: 'member',
      memberId: 'wonhee-id',
    })
  })

  it('other_version — Remake Ver. mentionne le groupe (pas un membre)', () => {
    expect(
      detectMvVersion("[STATION] aespa '시대유감 (時代遺憾) (2024 aespa Remake Ver.)' MV", AESPA),
    ).toEqual({ kind: 'other_version', memberId: null })
  })

  it('other_version — æ-aespa Ver. (sub-unit, pas un membre)', () => {
    expect(detectMvVersion("aespa 'Better Things' MV (æ-aespa Ver.)", AESPA)).toEqual({
      kind: 'other_version',
      memberId: null,
    })
  })

  it('other_version — English Ver. dans une paire imbriquée', () => {
    expect(detectMvVersion("aespa 'Life's Too Short (English Ver.)' MV", AESPA)).toEqual({
      kind: 'other_version',
      memberId: null,
    })
  })

  it('main quand members vide et pas de version', () => {
    expect(detectMvVersion('Title MV', [])).toEqual({ kind: 'main', memberId: null })
  })

  it("other_version si descripteur vide (parens contiennent juste 'ver.')", () => {
    expect(detectMvVersion('Title MV (ver.)', AESPA)).toEqual({
      kind: 'other_version',
      memberId: null,
    })
  })

  it('membre non reconnu (membre absent du groupe) → other_version', () => {
    expect(detectMvVersion("ILLIT 'It’s Me’ Official MV (KARINA ver.)", ILLIT)).toEqual({
      kind: 'other_version',
      memberId: null,
    })
  })
})
