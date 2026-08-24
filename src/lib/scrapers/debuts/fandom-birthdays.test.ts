import { describe, it, expect } from 'vitest'
import {
  parseBirthdayFromWikitext,
  titreDesigneLeMembre,
  memeGroupe,
  mentionneLeGroupe,
} from './fandom-birthdays'

// La date de naissance produit les events anniversaire : une date fausse est
// pire qu'une date absente, elle crée un event qui n'existe pas.
describe('parseBirthdayFromWikitext', () => {
  it('lit le template canonique', () => {
    expect(parseBirthdayFromWikitext('{{Birth date and age|1998|3|24}}')).toBe('1998-03-24')
  })

  it('lit le template avec un drapeau de format', () => {
    expect(parseBirthdayFromWikitext('{{Birth date and age|df=yes|2006|11|2}}')).toBe('2006-11-02')
  })

  it('lit la forme littérale', () => {
    expect(parseBirthdayFromWikitext('| birth_date = March 24, 1998')).toBe('1998-03-24')
  })

  it('refuse une date impossible plutôt que de la décaler', () => {
    // Un Date brut transformerait le 31 février en 3 mars, silencieusement.
    expect(parseBirthdayFromWikitext('{{Birth date and age|2000|2|31}}')).toBeNull()
    expect(parseBirthdayFromWikitext('{{Birth date and age|2000|13|1}}')).toBeNull()
  })

  it('refuse une année hors bornes plausibles', () => {
    expect(parseBirthdayFromWikitext('{{Birth date and age|1810|1|1}}')).toBeNull()
    expect(parseBirthdayFromWikitext('{{Birth date and age|2999|1|1}}')).toBeNull()
  })

  it('rend null quand la fiche ne porte pas de date', () => {
    expect(parseBirthdayFromWikitext('| name = TUIDE\n| debut = August 24, 2026')).toBeNull()
  })
})

describe('titreDesigneLeMembre', () => {
  it('accepte le titre nu et le titre désambiguïsé', () => {
    expect(titreDesigneLeMembre('Jia', 'Jia')).toBe(true)
    expect(titreDesigneLeMembre('Jia (TUIDE)', 'Jia')).toBe(true)
  })

  it('refuse la page du GROUPE arrivée en tête de recherche', () => {
    expect(titreDesigneLeMembre('TUIDE', 'Jia')).toBe(false)
  })

  it('refuse une autre personne — les noms de scène sont massivement homonymes', () => {
    expect(titreDesigneLeMembre('Jiah (Kep1er)', 'Jia')).toBe(false)
  })
})

describe('garde anti-homonyme', () => {
  it('accepte une désambiguïsation qui nomme le bon groupe', () => {
    expect(memeGroupe('ITZY', 'ITZY')).toBe(true)
    expect(memeGroupe('Itzy', 'ITZY')).toBe(true)
  })

  it("refuse la page d'une homonyme d'un AUTRE groupe", () => {
    // « Yuna » existe chez ITZY, chez Brave Girls, et ailleurs : sans ce garde
    // on écrivait une date plausible mais fausse, donc un anniversaire fantôme.
    expect(memeGroupe('Brave Girls', 'ITZY')).toBe(false)
  })

  it('accepte une page nue dont l’infobox cite le groupe', () => {
    expect(mentionneLeGroupe('| name = Jia\n| group = TUIDE\n', 'TUIDE')).toBe(true)
  })

  it('refuse une page nue qui ne cite pas le groupe', () => {
    expect(mentionneLeGroupe('| name = Jia\n| group = Kep1er\n', 'TUIDE')).toBe(false)
  })

  it('ne regarde que la tête de page : une mention lointaine ne prouve rien', () => {
    const loin = '| name = Jia\n' + 'x'.repeat(4000) + 'TUIDE'
    expect(mentionneLeGroupe(loin, 'TUIDE')).toBe(false)
  })
})
