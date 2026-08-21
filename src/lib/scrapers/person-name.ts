import { normalize } from './group-match'

/**
 * Formes de noms de personnes (nuit 2026-08-21).
 *
 * Incident : l'enrichissement MusicBrainz insérait des DOUBLONS à côté des
 * membres déjà corrects — EVNNE avait 9 rows pour 5 personnes (« Hanbin » ET
 * « Park, Han-bin »), MADEIN « Mashiro » ET « Sakamoto, Mashiro ». Cause : MB
 * renvoie un sort-name « Famille, Prénom » que le match normalisé ne
 * rapprochait pas du stage name k-pop, lequel est presque toujours le PRÉNOM
 * seul. Résultat : aucun match → insertion d'un second membre, avec en prime
 * une virgule dans un nom affiché à l'écran.
 */

/** « Park, Han-bin » → « Park Han-bin ». Sans virgule : inchangé. */
export function unsortPersonName(name: string): string {
  const m = /^([^,]+),\s*(.+)$/.exec(name)
  return m ? `${m[1].trim()} ${m[2].trim()}`.replace(/\s+/g, ' ') : name.trim()
}

/**
 * Formes normalisées sous lesquelles une même personne peut apparaître :
 * nom complet, nom dé-inversé, et le prénom seul (stage name k-pop usuel).
 * Le prénom seul n'est produit qu'à partir d'un sort-name explicite (virgule)
 * — jamais deviné sur un nom libre, pour ne pas rapprocher « Kim Minji » et
 * « Minji » de deux groupes différents par accident.
 */
export function personNameKeys(name: string): string[] {
  const keys = new Set<string>()
  const trimmed = name.trim()
  if (!trimmed) return []
  keys.add(normalize(trimmed))
  const unsorted = unsortPersonName(trimmed)
  keys.add(normalize(unsorted))
  const comma = /^([^,]+),\s*(.+)$/.exec(trimmed)
  if (comma) keys.add(normalize(comma[2])) // prénom seul : « Han-bin » → hanbin
  return [...keys].filter(Boolean)
}

/** Deux graphies désignent-elles la même personne ? (formes ci-dessus) */
export function samePersonName(a: string, b: string): boolean {
  const ka = personNameKeys(a)
  const kb = personNameKeys(b)
  return ka.some((k) => kb.includes(k))
}
