import { describe, expect, it } from 'vitest'
import { detectInfoboxKind, field, parseAgency } from './fandom'

describe('detectInfoboxKind', () => {
  it('{{Infobox person}} = artiste (Yves, pages membres)', () => {
    expect(detectInfoboxKind('{{Infobox person\n| name = Yves')).toBe('artist')
  })
  it('{{Infobox musical artist}} = groupe (aespa, TOZ — malgré le nom)', () => {
    expect(detectInfoboxKind('{{Infobox musical artist\n| name = aespa')).toBe('group')
  })
  it('page sans infobox connue = unknown', () => {
    expect(detectInfoboxKind('{{Quote|...}}\ntexte')).toBe('unknown')
  })
})

// Fixtures = champs label/agency RÉELS des infobox fandom (incident agences
// concaténées 2026-08-20 : Yves « Paix Per Mil GOLDEN MOON BlockBerryCreative
// Hunus Entertainment » en prod).
describe('parseAgency', () => {
  it('historique avec périodes → seulement les agences « present » (Yves)', () => {
    const raw =
      '[[w:c:khiphop:Paix Per Mil|Paix Per Mil]] {{small|(2024–present)}}<br>[[GOLDEN MOON]] {{Small|(2024–present)}}<br>[[BlockBerryCreative]] {{small|(2017–2023)}}<br>[[Hunus Entertainment]] {{small|(2015-2017)}}'
    expect(parseAgency(raw)).toBe('Paix Per Mil · GOLDEN MOON')
  })

  it('marqueurs de marché → section KR seulement (pow)', () => {
    const raw = "'''KR:''' [[GRID Entertainment]] '''US:''' Transparent Arts '''JP:''' 22 Label"
    expect(parseAgency(raw)).toBe('GRID Entertainment')
  })

  it('co-agences sans périodes → jointes par « · » (the-wind)', () => {
    const raw = '[[With US Entertainment]]<br>[[PPangStar Entertainment]]'
    expect(parseAgency(raw)).toBe('With US Entertainment · PPangStar Entertainment')
  })

  it('agence unique simple → inchangée', () => {
    expect(parseAgency('[[Cube Entertainment]]')).toBe('Cube Entertainment')
  })

  it('historique daté SANS present → première entrée (repli)', () => {
    const raw = '[[A Ent]] {{small|(2015–2020)}}<br>[[B Ent]] {{small|(2010–2015)}}'
    expect(parseAgency(raw)).toBe('A Ent')
  })

  it('périodes préfixées marché « (Korea; 2018–2021) » = datées (cas IZ*ONE)', () => {
    const raw =
      '[[Off The Record Entertainment]] {{small|(Korea; 2018–2021)}}<br>[[Swing Entertainment]] {{small|(Korea; 2018–2021)}}<br>[[Vernalossom]] {{small|(Japan; 2018–2021)}}'
    // Groupe dissous : aucun « present » → repli première entrée, jamais
    // l'historique complet collé.
    expect(parseAgency(raw)).toBe('Off The Record Entertainment')
  })

  it('mixte marché daté + present → seulement le present', () => {
    const raw =
      '[[A Ent]] {{small|(Korea; 2018–2021)}}<br>[[B Ent]] {{small|(Korea; 2021–present)}}'
    expect(parseAgency(raw)).toBe('B Ent')
  })

  it('champ vide → null', () => {
    expect(parseAgency('  ')).toBeNull()
  })
})

describe('field — un champ vide ne déborde pas sur le suivant', () => {
  // Wikitext RECOPIÉ de la page QQQ (2026-08-23) : `| label` est vide et le
  // champ suivant partait dans l'agence. Le défaut valait pour tout champ vide.
  const QQQ = `{{Group infobox
| name        = QQQ
| years       = 2025–present
| label       = 
| current     = 
* [[KB]]
* [[Jisung (QQQ)|Jisung]]
| fandom      = 
| colors      = 
}}`

  it('rend une chaîne vide, pas le contenu du champ suivant', () => {
    expect(field(QQQ, 'label')).toBe('')
    expect(field(QQQ, 'fandom')).toBe('')
  })

  it('lit toujours correctement un champ renseigné', () => {
    expect(field(QQQ, 'name')).toBe('QQQ')
    expect(field(QQQ, 'years')).toBe('2025–present')
    expect(field(QQQ, 'current')).toContain('[[KB]]')
  })

  it('un champ absent reste null', () => {
    expect(field(QQQ, 'agency')).toBeNull()
  })
})
