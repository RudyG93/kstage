import { describe, it, expect } from 'vitest'
import { buildMemberSlug } from './slug'

describe('buildMemberSlug', () => {
  it('compose groupSlug + stageName slugifié', () => {
    expect(buildMemberSlug('aespa', 'Karina')).toBe('aespa-karina')
    expect(buildMemberSlug('illit', 'Youngseo')).toBe('illit-youngseo')
    expect(buildMemberSlug('idle', 'Soojin')).toBe('idle-soojin')
  })

  it('strip les accents et caractères spéciaux du stage name', () => {
    expect(buildMemberSlug('blackpink', 'Rosé')).toBe('blackpink-rose')
    expect(buildMemberSlug('exo', 'D.O.')).toBe('exo-d-o')
  })

  it('collapse solo artists où groupSlug === slugify(stageName)', () => {
    // Cas dominant pour solistes : 1 groupe à 1 membre, même nom des deux côtés.
    expect(buildMemberSlug('lisa', 'Lisa')).toBe('lisa')
    expect(buildMemberSlug('iu', 'IU')).toBe('iu')
    expect(buildMemberSlug('rose', 'Rosé')).toBe('rose')
  })

  it('garde le composite quand le nameSlug starts with groupSlug mais ne l’égale pas', () => {
    // Pas de dédup partielle — on protège la cohérence inter-groupes.
    expect(buildMemberSlug('agustd', 'Agust D')).toBe('agustd-agust-d')
  })

  it('fallback vers groupSlug seul si stageName est vide ou que des séparateurs', () => {
    expect(buildMemberSlug('aespa', '')).toBe('aespa')
    expect(buildMemberSlug('aespa', '---')).toBe('aespa')
  })

  it('cap à 80 chars et trim trailing dash', () => {
    const long = 'A'.repeat(120)
    const out = buildMemberSlug('groupx', long)
    expect(out.length).toBeLessThanOrEqual(80)
    expect(out.endsWith('-')).toBe(false)
  })
})
