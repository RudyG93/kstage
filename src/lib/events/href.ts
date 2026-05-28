/**
 * Détermine l'href cible d'un event : page article `/mv/[slug]` pour les MVs
 * qui ont un slug, sinon page du groupe (comportement legacy pour les autres
 * types). Étendable plus tard à `/release/[slug]` etc.
 */
export function eventHref(event: {
  type: string
  slug: string | null
  groups?: { slug?: string | null } | null
}): string {
  if (event.type === 'mv' && event.slug) return `/mv/${event.slug}`
  const groupSlug = event.groups?.slug ?? ''
  return `/groups/${groupSlug}`
}
