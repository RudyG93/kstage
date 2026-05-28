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
 * Si la combinaison est déjà prise, le caller incrémente (`-2`, `-3`, …).
 */
export function buildEventSlug(groupSlug: string, title: string): string {
  const titleSlug = slugify(title)
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
