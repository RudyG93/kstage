import { slugify } from '@/lib/events/slug'

/**
 * Construit un slug membre canonique : `{groupSlug}-{slugify(stageName)}`.
 *
 * Composite global → cherchable en O(1) via l'index unique `members_slug_uniq`,
 * route `/artists/[slug]` triviale (pas de parsing à la requête).
 *
 * Cas spécial solo : quand le nameSlug est identique au groupSlug (ex. solo
 * artist Lisa / groupe "Lisa"), on ne dédouble pas → slug = `lisa` au lieu
 * de `lisa-lisa`. Idem si le nameSlug start avec groupSlug (`agust-d` dans
 * groupe `agustd` → garde `agustd-agust-d` car distinct).
 *
 * Exemples : `aespa-karina`, `illit-youngseo`, `idle-soojin`, `lisa`, `iu`.
 */
export function buildMemberSlug(groupSlug: string, stageName: string): string {
  const nameSlug = slugify(stageName)
  if (!nameSlug) return groupSlug
  if (nameSlug === groupSlug) return groupSlug
  const base = `${groupSlug}-${nameSlug}`
  return base.slice(0, 80).replace(/-+$/, '')
}
