// Normalise un titre d'event scrapé pour l'affichage :
//  1. retire le préfixe groupe (ex. "ATEEZ Album - Golden Hour" → "Golden Hour"),
//  2. supprime l'année trailing entre parenthèses ("(2026)"),
//  3. normalise "Part.5" → "Part 5" (les uploads YouTube collent souvent un point).
// Le nom du groupe est déjà affiché à gauche/au-dessus → inutile de le répéter.
export function displayEventTitle(title: string, groupName?: string | null): string {
  let t = title
  if (groupName) {
    const escaped = groupName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Séparateurs supportés : em-dash (—), en-dash (–), hyphen (-), colon (:).
    // kpopofficial utilise en-dash, YouTube/MV utilisent souvent em-dash ou hyphen.
    t = t.replace(new RegExp(`^${escaped}(?:\\s+\\w+)*\\s*[—–\\-:]\\s*`, 'i'), '')
  }
  t = t.replace(/\s*\(\d{4}\)\s*$/, '')
  t = t.replace(/\b(\w+)\.(\d+)\b/g, '$1 $2')
  return t.trim()
}

// Suffixes "MV"-style strippés en fallback : ce qu'on enlève quand le titre
// n'a pas de quotes pour la chanson. Order matters : longest patterns first.
const TRAILING_MV_RE =
  /\s*[—–\-:]?\s*(Official Music Video|Music Video|Official MV|Official Video|MV|M\/V)\s*$/i

/**
 * Extrait uniquement le titre de la chanson depuis un titre scrapé YouTube.
 *
 * Priorité 1 : contenu de la première paire de quotes — curly ‘ ’ (YT majoritaire),
 * straight ' ', ou double " ". Couvre 95% des MVs car YT met systématiquement
 * la chanson entre quotes (`aespa 에스파 'Whiplash' Official MV` → `Whiplash`).
 *
 * Priorité 2 (fallback) : `displayEventTitle` puis strip des suffixes "MV /
 * Official Music Video / M/V" en fin de titre.
 *
 * Utilisé sur les surfaces où on veut un label court (sidebar Recent
 * comebacks). Pour les surfaces où on garde plus de contexte (cards MV grid,
 * page article), continuer d'utiliser `displayEventTitle`.
 */
export function displaySongTitle(title: string, groupName?: string | null): string {
  const m = title.match(/[‘]([^’]+)[’]/) || title.match(/'([^']+)'/) || title.match(/"([^"]+)"/)
  if (m) return m[1].trim()

  return displayEventTitle(title, groupName).replace(TRAILING_MV_RE, '').trim()
}
