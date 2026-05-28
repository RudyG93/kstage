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
