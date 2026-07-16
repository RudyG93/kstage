import { describe, it, expect } from 'vitest'
import { filterGroups, DEFAULT_SHOWN } from './filter-groups'

const g = (name: string, id = name) => ({ id, name, image: null })
const many = Array.from({ length: 50 }, (_, i) => g(`Group ${i}`, `id-${i}`))

describe('filterGroups', () => {
  it('requête vide → top 30 (ordre serveur préservé)', () => {
    const out = filterGroups(many, '')
    expect(out).toHaveLength(DEFAULT_SHOWN)
    expect(out[0].id).toBe('id-0')
  })

  it('match sous-chaîne insensible à la casse sur TOUTE la liste', () => {
    const groups = [...many, g('LE SSERAFIM'), g('aespa')]
    expect(filterGroups(groups, 'sserafim').map((x) => x.name)).toEqual(['LE SSERAFIM'])
    expect(filterGroups(groups, 'AES').map((x) => x.name)).toEqual(['aespa'])
  })

  it('pliage des accents (précédent APT : é ↔ e)', () => {
    const groups = [g('Sérénité'), g('IVE')]
    expect(filterGroups(groups, 'serenite').map((x) => x.name)).toEqual(['Sérénité'])
  })

  it('aucun match → liste vide (l’UI affiche un empty state)', () => {
    expect(filterGroups(many, 'zzzz')).toEqual([])
  })

  it('espaces parasites ignorés', () => {
    expect(filterGroups([g('NewJeans')], '  newjeans  ')).toHaveLength(1)
  })
})
