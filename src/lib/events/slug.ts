// Génère un slug URL-safe à partir d'une chaîne libre.
// Pattern : ascii-fold (NFKD + suppression des marques de combinaison), lowercase,
// remplacement des non-alphanum par `-`, dédoublonnage + trim des `-`.
//
// Utilisé pour `events.slug` (route `/mv/[slug]`). Le caller est responsable du
// préfixage par le groupe et de la gestion des collisions (cf. backfill / scrape).
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // marques de combinaison Unicode (accents)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Construit un slug d'event canonique : `{groupSlug}-{titleSlug}`.
 *
 * Si le titre commence déjà par le nom du groupe (cas dominant : kpopofficial
 * publie `ATEEZ Album – GOLDEN HOUR …` pour le groupe `ATEEZ`), on dédupliquerait
 * le préfixe ⇒ `ateez-ateez-album-…`. On strip donc en amont, en tenant compte
 * de deux formes possibles du nom :
 *   - `groupSlug` lui-même (cas où il matche slugify(title) en tête)
 *   - `slugify(groupName)` (cas où group.slug ≠ slugify(group.name), ex.
 *     `nflying` vs `n-flying`, `fiftyfifty` vs `fifty-fifty`)
 *
 * Si la combinaison résultante est déjà prise en DB, le caller incrémente
 * (`-2`, `-3`, …) via `generateUniqueSlug`.
 */
export function buildEventSlug(
  groupSlug: string,
  title: string,
  groupName?: string | null,
): string {
  let titleSlug = slugify(title)
  if (titleSlug) {
    const prefixes = new Set<string>()
    prefixes.add(`${groupSlug}-`)
    if (groupName) {
      const nameSlug = slugify(groupName)
      if (nameSlug) prefixes.add(`${nameSlug}-`)
    }
    for (const p of prefixes) {
      if (titleSlug.startsWith(p)) {
        titleSlug = titleSlug.slice(p.length)
        break
      }
    }
  }
  const base = titleSlug ? `${groupSlug}-${titleSlug}` : groupSlug
  // Limite raisonnable pour URL lisible et compatible index DB.
  return base.slice(0, 80).replace(/-+$/, '')
}

/**
 * Résout les collisions de slug en suffixant `-2`, `-3`, … jusqu'à trouver
 * une valeur libre. `isTaken` est injecté pour rester testable et indépendant
 * du contexte (script CLI vs Server Action vs scraper).
 */
export async function generateUniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  let candidate = base
  let i = 2
  while (await isTaken(candidate)) {
    candidate = `${base}-${i++}`
  }
  return candidate
}
