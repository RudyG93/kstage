/**
 * Destination d'une carte d'event selon son type. Règle clé : on ne renvoie
 * JAMAIS vers une source scrapée / site concurrent (kpopofficial, carrd…).
 *
 * - `mv` (+ slug) → page article interne `/mv/[slug]`.
 * - `music_show` → la vidéo YouTube du passage **uniquement si `stage_url` est
 *   une URL YouTube** (posée par l'enrichissement stage-links, colonne dédiée
 *   depuis la migration 0039 — `source_url` reste la clé d'idempotence carrd
 *   et ne route jamais) ; sinon page du groupe.
 * - `release` / `anniversary` / `live` / `concert` / `other` → page du groupe.
 */
const YOUTUBE_RE = /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i

export function eventHref(event: {
  type: string
  slug: string | null
  stage_url?: string | null
  groups?: { slug?: string | null } | null
}): string {
  if (event.type === 'mv' && event.slug) {
    return `/mv/${event.slug}`
  }
  if (event.type === 'music_show' && event.stage_url && YOUTUBE_RE.test(event.stage_url)) {
    return event.stage_url
  }
  return `/groups/${event.groups?.slug ?? ''}`
}

/** Un href externe (http[s]) doit s'ouvrir dans un nouvel onglet. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//.test(href)
}
