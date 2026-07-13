// Normalise un titre d'event scrapé pour l'affichage :
//  1. releases kpopofficial : le titre stocké est « <Artiste> <Descripteur
//     d'édition> – <Nom> (<Année>) » — le nom réel est TOUJOURS après le
//     dernier en/em-dash. L'ancienne heuristique `(?:\s+\w+)*` butait sur les
//     descripteurs à tiret interne (« Pre-release Single ») → « release
//     Single - Crow » (retour Rudy 2026-07-12). On prend le segment après le
//     dernier – / — s'il est non vide (« Mark on Me » et « NCT 127 7th Full
//     Album » n'ont pas d'en-dash → intacts).
//  2. autres types : retire le préfixe groupe (ex. "ATEEZ - Golden Hour"),
//  3. supprime l'année trailing entre parenthèses ("(2026)"),
//  4. normalise "Part.5" → "Part 5" (les uploads YouTube collent souvent un point).
// Le nom du groupe est déjà affiché à gauche/au-dessus → inutile de le répéter.
export function displayEventTitle(
  title: string,
  groupName?: string | null,
  episodeNumber?: number | null,
  type?: string | null,
): string {
  // MVs (R5, 2026-07-13) : même nommage court partout — le nom de la chanson
  // seul (« Crow »), sans « Groupe 'X' Official MV ». displaySongTitle
  // rappelle displayEventTitle SANS type → pas de récursion.
  if (type === 'mv') {
    const song = displaySongTitle(title, groupName)
    if (song) return song
  }
  let t = title
  const dashSegment =
    type === 'release'
      ? title
          .split(/\s+[–—]\s+/)
          .at(-1)
          ?.trim()
      : undefined
  if (dashSegment && dashSegment !== title && dashSegment.replace(/\s*\(\d{4}\)\s*$/, '').trim()) {
    t = dashSegment
  } else if (groupName) {
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
