// Normalisation Unicode-aware : lowercase + retire tout ce qui n'est ni lettre
// ni chiffre (ponctuation, espaces, tirets, parenthèses…). Garde les caractères
// non-ASCII (hangul, kana) — utile pour matcher des descriptions YouTube qui
// citent le groupe en coréen ("에스파 'Whiplash' MV").
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * Vérifie qu'un texte (titre + description vidéo) mentionne le groupe ciblé.
 * Comparaison après normalisation, donc tolérante aux variantes typographiques
 * courantes : "AESPA", "aespa", "(G)I-DLE", "BABYMONSTER (베이비몬스터)"...
 *
 * Renvoie false si `groupName` est vide ou si la normalisation produit une
 * chaîne vide (sinon n'importe quel texte matcherait).
 */
export function matchesGroup(text: string, groupName: string | null | undefined): boolean {
  if (!groupName) return false
  const needle = normalize(groupName)
  if (!needle) return false
  return normalize(text).includes(needle)
}
