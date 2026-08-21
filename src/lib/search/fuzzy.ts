/**
 * Tolérance aux fautes de frappe pour la recherche (demande Rudy 2026-08-21 :
 * « si ça écorche quelques lettres ou en échange quelques unes »).
 *
 * Distance de Damerau-Levenshtein — Levenshtein PLUS la transposition de deux
 * caractères adjacents comptée comme UNE seule faute. C'est le point : sur un
 * clavier, l'erreur la plus fréquente est l'inversion (« aepsa » pour
 * « aespa »), que Levenshtein classique facture 2 et rejetterait donc au même
 * titre qu'un mot différent.
 *
 * Bornée : on abandonne dès que toute la ligne dépasse le budget, donc le coût
 * est O(n × max) et non O(n × m). Sur 256 groupes ou 1 200 membres c'est
 * négligeable, et ça évite de comparer des chaînes sans rapport jusqu'au bout.
 *
 * Toutes les entrées sont attendues DÉJÀ normalisées (cf. `normalize` de
 * group-match : minuscules, sans accents ni séparateurs, hangul préservé).
 */

/** Distance de Damerau-Levenshtein, ou `null` si elle dépasse `max`. */
export function boundedEditDistance(a: string, b: string, max: number): number | null {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return null
  if (a.length === 0) return b.length <= max ? b.length : null
  if (b.length === 0) return a.length <= max ? a.length : null

  let prev2: number[] = []
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row: number[] = new Array(b.length + 1)
    row[0] = i
    let best = row[0]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
      // Transposition : « ab » ↔ « ba » coûte 1, pas 2.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1)
      }
      row[j] = v
      if (v < best) best = v
    }
    // Toute la ligne dépasse le budget : aucune suite ne peut redescendre.
    if (best > max) return null
    prev2 = prev
    prev = row
  }
  const d = prev[b.length]
  return d <= max ? d : null
}

/**
 * Budget de fautes selon la longueur de la saisie. Deux fautes sur « babymonstr »
 * reste reconnaissable ; deux fautes sur « ive » désignerait n'importe quoi.
 */
export function allowedEdits(len: number): number {
  if (len < 4) return 0
  if (len <= 7) return 1
  return 2
}

/** Longueur minimale d'une saisie pour tenter l'approximation. */
export const MIN_FUZZY_LEN = 4

/**
 * `needle` approche-t-il `target` ? (les deux normalisés)
 *
 * Trois façons, de la plus sûre à la plus permissive :
 *   1. `target` contient `needle` — la recherche exacte d'aujourd'hui ;
 *   2. distance bornée sur la chaîne entière (« babymonstre » ↔ « babymonster ») ;
 *   3. distance bornée sur le DÉBUT de `target` de la longueur de la saisie —
 *      une frappe partielle ET fautive (« babymonstr » pendant qu'on tape).
 */
export function fuzzyMatches(needle: string, target: string): boolean {
  if (!needle || !target) return false
  if (target.includes(needle)) return true
  if (needle.length < MIN_FUZZY_LEN) return false
  const max = allowedEdits(needle.length)
  if (boundedEditDistance(needle, target, max) !== null) return true
  // Frappe partielle ET fautive : on compare au DÉBUT de la cible, à quelques
  // longueurs près — « stary » doit retrouver « straykids » via le début
  // « stray » (inversion), pas via « strayk » qui coûterait une insertion de
  // plus. Au plus 2·max + 1 comparaisons bornées.
  const lo = Math.max(1, needle.length - max)
  const hi = Math.min(target.length - 1, needle.length + max)
  for (let len = lo; len <= hi; len++) {
    if (boundedEditDistance(needle, target.slice(0, len), max) !== null) return true
  }
  return false
}

/**
 * Score de proximité, plus BAS = meilleur. Sert à trier : l'exact d'abord,
 * le préfixe ensuite, l'approximatif en dernier — pour qu'une correspondance
 * approximative ne passe jamais devant une correspondance franche.
 */
export function matchRank(needle: string, target: string): number {
  if (target === needle) return 0
  if (target.startsWith(needle)) return 1
  if (target.includes(needle)) return 2
  return 3
}
