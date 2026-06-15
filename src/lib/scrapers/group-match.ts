// Normalisation Unicode-aware : lowercase + retire tout ce qui n'est ni lettre
// ni chiffre (ponctuation, espaces, tirets, parenthèses…). Garde les caractères
// non-ASCII (hangul, kana) — utile pour matcher des descriptions YouTube qui
// citent le groupe en coréen ("에스파 'Whiplash' MV").
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

// Crédits de featuring entre parenthèses/crochets : « (feat. j-hope of BTS) »,
// « (with X) », « (prod. Y) ». On les retire AVANT de matcher car le nom d'un
// invité ne désigne pas l'artiste interprète. Sans ça, le MV « LE SSERAFIM
// (르세라핌) 'SPAGHETTI (feat. j-hope of BTS)' OFFICIAL MV » était attribué à BTS
// (le « of BTS » du crédit contient « bts ») — faux positif vu au backfill P0.5.
const FEATURING_RE = /[([]\s*(?:feat|ft|with|prod)\b[^)\]]*[)\]]/gi

/**
 * Vérifie qu'un texte (titre vidéo) mentionne le groupe ciblé.
 * Comparaison après normalisation, donc tolérante aux variantes typographiques
 * courantes : "AESPA", "aespa", "(G)I-DLE", "BABYMONSTER (베이비몬스터)"...
 * Les crédits de featuring entre parenthèses sont ignorés (cf. FEATURING_RE).
 *
 * Renvoie false si `groupName` est vide ou si la normalisation produit une
 * chaîne vide (sinon n'importe quel texte matcherait).
 */
export function matchesGroup(text: string, groupName: string | null | undefined): boolean {
  if (!groupName) return false
  const needle = normalize(groupName)
  if (!needle) return false
  return normalize(text.replace(FEATURING_RE, ' ')).includes(needle)
}
