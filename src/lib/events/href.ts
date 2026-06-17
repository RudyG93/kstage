/**
 * Destination d'une carte d'event selon son type. Règle clé : on ne renvoie
 * JAMAIS vers une source scrapée / site concurrent (kpopofficial, carrd…).
 *
 * - `mv` (+ slug) → page article interne `/mv/[slug]`.
 * - `music_show` → la page YouTube du show **uniquement si `source_url` est une
 *   URL YouTube** ; sinon page du groupe (jamais la source carrd).
 * - `release` / `anniversary` / `live` / `concert` / `other` → page du groupe.
 */
const YOUTUBE_RE = /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i

export function eventHref(event: {
  type: string
  slug: string | null
  source_url?: string | null
  groups?: { slug?: string | null } | null
}): string {
  if (event.type === 'mv' && event.slug) {
    return `/mv/${event.slug}`
  }
  if (event.type === 'music_show' && event.source_url && YOUTUBE_RE.test(event.source_url)) {
    return event.source_url
  }
  return `/groups/${event.groups?.slug ?? ''}`
}

/** Un href externe (http[s]) doit s'ouvrir dans un nouvel onglet. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//.test(href)
}
