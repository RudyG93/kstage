/**
 * Destination d'une carte d'event selon son type. Règle clé : on ne renvoie
 * JAMAIS vers une source scrapée / site concurrent (kpopofficial, carrd…).
 *
 * - `mv` (+ slug) → page article interne `/mv/[slug]`.
 * - `music_show` → page ÉPISODE interne `/show/[show]/[day]` (Lot N
 *   2026-07-17 — évolution du ledger « stage links » : la vidéo YouTube du
 *   passage reste accessible DANS la page épisode) ; repli stage_url YouTube
 *   puis page du groupe pour un show inconnu du descripteur.
 * - `release` / `anniversary` / `live` / `concert` / `other` → page du groupe.
 */
import { kstDayKey } from './date'
import { SHOW_ID_BY_TITLE } from '@/lib/scrapers/music-shows/types'

const YOUTUBE_RE = /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i

/** `/show/inkigayo/2026-07-19` — page épisode d'un music show connu, sinon null. */
export function episodeHref(event: {
  title?: string | null
  start_at?: string | null
}): string | null {
  const showId = event.title ? SHOW_ID_BY_TITLE[event.title] : undefined
  if (!showId || !event.start_at) return null
  return `/show/${showId}/${kstDayKey(event.start_at)}`
}

export function eventHref(event: {
  type: string
  slug: string | null
  title?: string | null
  start_at?: string | null
  stage_url?: string | null
  groups?: { slug?: string | null; artist_slug?: string | null } | null
}): string {
  if (event.type === 'mv' && event.slug) {
    return `/mv/${event.slug}`
  }
  if (event.type === 'music_show') {
    const episode = episodeHref(event)
    if (episode) return episode
    if (event.stage_url && YOUTUBE_RE.test(event.stage_url)) return event.stage_url
  }
  return groupHref(event.groups ?? {})
}

/** Un href externe (http[s]) doit s'ouvrir dans un nouvel onglet. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//.test(href)
}

/**
 * Href canonique d'un GROUPE. Un groupe solo n'a pas de page groupe :
 * `/groups/<slug>` répond 307 vers `/artists/<artist_slug>`. Tout lien interne
 * doit désigner la page finale — sinon on paie un aller-retour au clic, et un
 * crawler suit une redirection pour rien. Le slug de l'artiste n'est pas
 * déductible de celui du groupe (9 des 38 solistes diffèrent), d'où la colonne
 * dénormalisée `groups.artist_slug` (migration 0068).
 */
export function groupHref(group: { slug?: string | null; artist_slug?: string | null }): string {
  if (group.artist_slug) return `/artists/${group.artist_slug}`
  return `/groups/${group.slug ?? ''}`
}
