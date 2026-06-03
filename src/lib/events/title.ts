// Normalise un titre d'event scrapé pour l'affichage :
//  1. retire le préfixe groupe (ex. "ATEEZ Album - Golden Hour" → "Golden Hour"),
//  2. supprime l'année trailing entre parenthèses ("(2026)"),
//  3. normalise "Part.5" → "Part 5" (les uploads YouTube collent souvent un point).
// Le nom du groupe est déjà affiché à gauche/au-dessus → inutile de le répéter.
export function displayEventTitle(
  title: string,
  groupName?: string | null,
  episodeNumber?: number | null,
): string {
  let t = title
  if (groupName) {
    const escaped = groupName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Séparateurs supportés : em-dash (—), en-dash (–), hyphen (-), colon (:).
    // kpopofficial utilise en-dash, YouTube/MV utilisent souvent em-dash ou hyphen.
    t = t.replace(new RegExp(`^${escaped}(?:\\s+\\w+)*\\s*[—–\\-:]\\s*`, 'i'), '')
  }
  t = t.replace(/\s*\(\d{4}\)\s*$/, '')
  t = t.replace(/\b(\w+)\.(\d+)\b/g, '$1 $2')
  t = t.trim()
  // Music shows : suffixe le numéro d'épisode (ex. "Inkigayo #328").
  if (episodeNumber != null) t = `${t} #${episodeNumber}`
  return t
}

// Suffixes "MV"-style strippés en fallback : ce qu'on enlève quand le titre
// n'a pas de quotes pour la chanson. Order matters : longest patterns first.
const TRAILING_MV_RE =
  /\s*[—–\-:]?\s*(Official Music Video|Music Video|Official MV|Official Video|MV|M\/V)\s*$/i

/**
 * Extrait uniquement le titre de la chanson depuis un titre scrapé YouTube.
 *
 * Priorité 1 — quotes greedy : capture le contenu entre la PREMIÈRE quote
 * d'ouverture et la DERNIÈRE quote de fermeture. Greedy `.+` au lieu de
 * `[^x]+` non-greedy pour gérer les apostrophes intérieures (ex: `It's Me`
 * où le titre prod utilise des `'` straight outer + `'` straight possessif).
 *   Curly : `‘…’` (YouTube majoritaire)
 *   Straight : `'…'`  (occasionnel + cas avec apostrophe interne)
 *   Double : `"…"` (rare)
 * Edge case `'A' Official 'B' MV` captures `A' Official 'B` — peu probable
 * dans les titres K-pop scrapés.
 *
 * Priorité 2 — fallback enrichi : `displayEventTitle` puis strip
 *   (a) groupName + parens optionnelles (hangul/japonais) en début,
 *   (b) suffixes "MV / Official Music Video / M/V" en fin.
 *
 * Utilisé sur les surfaces qui veulent un label court (sidebar Recent
 * comebacks). Pour les surfaces qui gardent plus de contexte (MvsGrid
 * cards, page article), continuer d'utiliser `displayEventTitle`.
 */
export function displaySongTitle(title: string, groupName?: string | null): string {
  const m = title.match(/[‘](.+)[’]/) || title.match(/'(.+)'/) || title.match(/"(.+)"/)
  if (m) return m[1].trim()

  let t = displayEventTitle(title, groupName)
  if (groupName) {
    const escaped = groupName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Strip `${groupName} ` ou `${groupName} (...) ` en début, case-insensitive.
    // La paire de parens optionnelle couvre les nom hangul/japonais : "ILLIT
    // (아일릿) Magnetic" → "Magnetic" ; "aespa (에스파) WDA" → "WDA".
    t = t.replace(new RegExp(`^${escaped}\\s*(?:\\([^)]+\\)\\s*)?`, 'i'), '')
  }
  return t.replace(TRAILING_MV_RE, '').trim()
}
