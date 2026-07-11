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

// Hashtags de fin de titre : sur les chaînes de label partagées, ils citent la
// COMPAGNIE ou d'autres artistes maison (« 유아유(UAU) 'GENE' MV … #Dreamcatcher_UAU »
// attribuait un MV de UAU à Dreamcatcher — audit prod 2026-07-03). Convention
// k-pop : l'artiste interprète figure dans le titre éditorial, pas en hashtag.
const HASHTAG_RE = /#[^\s#]+/g

/** Retire les hashtags d'un titre (avant group-match). */
export function stripHashtags(s: string): string {
  return s.replace(HASHTAG_RE, ' ')
}

/**
 * Distance d'édition ≤ 1 (une insertion, suppression ou substitution).
 * Sert la tolérance typo du matching des lineups music shows : le carrd a
 * écrit « Heart2Hearts » pour Hearts2Hearts (M Countdown EP.936, 2026-07-09)
 * → le groupe a manqué l'épisode. À réserver aux clés normalisées LONGUES
 * (≥ 8 chars) — les noms courts collisionnent (izna/i-dle…).
 */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true
  const [s, l] = a.length <= b.length ? [a, b] : [b, a]
  if (l.length - s.length > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < s.length && j < l.length) {
    if (s[i] === l[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (s.length === l.length) i++ // substitution
    j++ // insertion dans le plus long
  }
  return edits + (l.length - j) + (s.length - i) <= 1
}

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
  // 1) Titre éditorial (hashtags retirés, crédits feat. ignorés).
  if (normalize(stripHashtags(text).replace(FEATURING_RE, ' ')).includes(needle)) return true
  // 2) Repli : un hashtag STRICTEMENT égal au nom du groupe compte (certaines
  //    chaînes officielles titrent « #ENHYPEN 'Knife' Official MV »). L'égalité
  //    est exacte, pas une inclusion : « #Dreamcatcher_UAU » ne matche PAS
  //    Dreamcatcher (c'est le tag maison d'un autre artiste du label).
  const hashtags = text.match(HASHTAG_RE) ?? []
  return hashtags.some((h) => normalize(h) === needle)
}
