/**
 * Détermine l'href cible d'un event selon son type (§4) :
 * - `mv` / `release` avec slug → page article interne `/mv/[slug]`
 * - `music_show` / `live` / `concert` / `other` / `release` → source officielle
 *   externe (`source_url`) si présente (broadcaster, Premiere YouTube, tweet…)
 * - sinon (anniversary, ou pas de destination) → page du groupe.
 *
 * Les appelants qui ne fournissent pas `source_url` retombent naturellement sur
 * le fallback groupe — comportement inchangé pour eux.
 */
export function eventHref(event: {
  type: string
  slug: string | null
  source_url?: string | null
  groups?: { slug?: string | null } | null
}): string {
  if ((event.type === 'mv' || event.type === 'release') && event.slug) {
    return `/mv/${event.slug}`
  }
  const EXTERNAL_TYPES = ['music_show', 'live', 'concert', 'other', 'release']
  if (event.source_url && EXTERNAL_TYPES.includes(event.type)) {
    return event.source_url
  }
  return `/groups/${event.groups?.slug ?? ''}`
}

/** Un href externe (http[s]) doit s'ouvrir dans un nouvel onglet. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//.test(href)
}
