/**
 * Normalise un nom d'artiste tel qu'il apparaît dans le lineup brut de
 * `liveshowupdatess.carrd.co` (ou tout autre source music show) pour le rendre
 * matchable contre nos `groups.name` / `groups.slug`.
 *
 * Cas observés dans la fixture 2026-05-29 (Music Bank, M Countdown, Inkigayo, etc.) :
 *   "aespa"                          → "aespa"
 *   "ILLIT"                          → "ILLIT"
 *   "아일릿(ILLIT)"                   → "ILLIT"   (strip Korean prefix avant les parens)
 *   "ITZY(있지)"                      → "ITZY"    (strip Korean dans les parens en suffix)
 *   "원위(ONEWE)"                     → "ONEWE"
 *   "태양 (feat. TARZZAN, WOOCHAN)"   → "태양"    (strip feat. annotation)
 *   "TAEYANG (feat. TARZZAN, WOOCHAN)" → "TAEYANG"
 *   "Park Hyun Kyu"                  → "Park Hyun Kyu"  (laisse les noms ASCII intacts)
 *
 * Heuristique :
 *   1) Strip parenthesized `(feat. …)` ou `(ft. …)` partout.
 *   2) Si la string finit par `(EnglishName)` → on garde uniquement EnglishName.
 *   3) Si la string finit par `(KoreanName)` → on enlève juste les parens.
 *   4) Trim + collapse whitespace.
 */
export function extractCanonicalName(raw: string): string {
  let s = raw.trim()
  if (!s) return ''

  // Strip "(feat. …)" / "(ft. …)" insensible à la casse, même au milieu de la string.
  s = s.replace(/\s*\(\s*(?:feat\.?|ft\.?)\s[^)]*\)/gi, '')

  // Strip "feat. …" sans parens (fin de string seulement).
  s = s.replace(/\s+(?:feat\.?|ft\.?)\s+.+$/i, '')

  // Si la string finit par "(...)" en fin de chaîne :
  const trailing = s.match(/^(.+?)\s*\(\s*([^()]+?)\s*\)\s*$/)
  if (trailing) {
    const outside = trailing[1].trim()
    const inside = trailing[2].trim()
    // Si l'intérieur des parens est purement ASCII (lettres/chiffres/espaces/dot/dash) →
    // on suppose que c'est le nom canonique anglais ("아일릿(ILLIT)" → "ILLIT").
    const insideIsAscii = /^[\p{ASCII}]+$/u.test(inside) && /[A-Za-z]/.test(inside)
    // Si l'extérieur des parens est purement ASCII → on suppose que c'est le nom
    // canonique et l'intérieur est la version coréenne ("ITZY(있지)" → "ITZY").
    const outsideIsAscii = /^[\p{ASCII}]+$/u.test(outside) && /[A-Za-z]/.test(outside)
    if (insideIsAscii && !outsideIsAscii) s = inside
    else if (outsideIsAscii && !insideIsAscii) s = outside
    // Sinon (les deux ASCII ou les deux non-ASCII) on laisse tel quel — peu commun.
  }

  // Collapse whitespace + final trim.
  return s.replace(/\s+/g, ' ').trim()
}
