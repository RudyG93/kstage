import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { SITE_URL } from '@/lib/site'
import { kstDayKey } from '@/lib/events/date'
import { SHOW_ID_BY_TITLE } from '@/lib/scrapers/music-shows/types'

// Regénéré au plus 1×/jour — sinon le sitemap fige au build.
export const revalidate = 86400

// Sitemap programmatique : ~940 pages (groupes, MVs, artistes) exposées aux
// moteurs — le levier d'acquisition passive n°1 (recherches « {groupe}
// comeback 2026 »). Pas de cookies dans ce contexte → client supabase-js nu
// avec la clé anon (tables publiques en lecture via RLS). Exclusions :
// groupes solo (redirect 308 vers /artists) et membres non canoniques
// (redirect) — un sitemap ne doit pas lister de redirections.

/**
 * Pagination RÉELLE (nuit 2026-08-21) : `.range(0, 4999)` ne contourne pas le
 * plafond serveur de PostgREST — il rendait exactement 1000 lignes, en silence.
 * Le sitemap listait donc 1000 MV sur 2929 et 1000 artistes sur 1234 : les deux
 * tiers du catalogue étaient invisibles des moteurs. On boucle par lots de 1000
 * jusqu'à épuisement.
 */
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) break
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) break
  }
  return out
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // Gate de confiance (Phase 3 Lot 2) : les groupes `candidate` (identité
  // ambiguë) sont noindexés → ils ne doivent pas non plus être sitemappés.
  // Même correction pour les pre-debut (noindexés depuis toujours mais
  // sitemappés — incohérence historique).
  const today = new Date().toISOString().slice(0, 10)
  const [groupsRes, mvsRes, membersRes, showsRes] = await Promise.all([
    supabase
      .from('groups')
      .select('slug')
      .eq('is_solo', false)
      .neq('confidence', 'candidate')
      .or(`debut_date.is.null,debut_date.lte.${today}`),
    fetchAllRows<{ slug: string | null; updated_at: string | null }>((from, to) =>
      supabase
        .from('events')
        .select('slug, updated_at, groups!inner(confidence)')
        .eq('type', 'mv')
        .not('slug', 'is', null)
        .eq('hidden', false)
        .neq('groups.confidence', 'candidate')
        .range(from, to),
    ).then((data) => ({ data })),
    fetchAllRows<{ slug: string | null }>((from, to) =>
      supabase
        .from('members')
        .select('slug')
        .not('slug', 'is', null)
        .is('canonical_id', null)
        .range(from, to),
    ).then((data) => ({ data })),
    fetchAllRows<{ title: string; start_at: string }>((from, to) =>
      supabase
        .from('events')
        .select('title, start_at')
        .eq('type', 'music_show')
        .eq('hidden', false)
        .range(from, to),
    ).then((data) => ({ data })),
  ])

  const statics: MetadataRoute.Sitemap = ['', '/calendar', '/groups', '/mvs', '/search'].map(
    (path) => ({ url: `${SITE_URL}${path}` }),
  )
  const groups: MetadataRoute.Sitemap = (groupsRes.data ?? []).map((g) => ({
    url: `${SITE_URL}/groups/${g.slug}`,
  }))
  // lastModified seulement là où une vraie colonne existe (events.updated_at) —
  // ne pas mentir aux moteurs avec new Date().
  const mvs: MetadataRoute.Sitemap = (mvsRes.data ?? []).map((e) => ({
    url: `${SITE_URL}/mv/${e.slug}`,
    ...(e.updated_at ? { lastModified: new Date(e.updated_at) } : {}),
  }))
  const artists: MetadataRoute.Sitemap = (membersRes.data ?? []).map((m) => ({
    url: `${SITE_URL}/artists/${m.slug}`,
  }))
  // Pages épisode /show/[show]/[day] (absentes du sitemap depuis leur création
  // — audit 2026-08-20) : un event music_show par passage → dédup par
  // (show, jour KST), même mapping titre→id que la page (episodeHref).
  const episodeUrls = new Set<string>()
  for (const e of showsRes.data ?? []) {
    const showId = e.title ? SHOW_ID_BY_TITLE[e.title] : undefined
    if (showId && e.start_at) episodeUrls.add(`${SITE_URL}/show/${showId}/${kstDayKey(e.start_at)}`)
  }
  const episodes: MetadataRoute.Sitemap = [...episodeUrls].map((url) => ({ url }))

  return [...statics, ...groups, ...mvs, ...artists, ...episodes]
}
