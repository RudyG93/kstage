import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { SITE_URL } from '@/lib/site'

// Regénéré au plus 1×/jour — sinon le sitemap fige au build.
export const revalidate = 86400

// Sitemap programmatique : ~940 pages (groupes, MVs, artistes) exposées aux
// moteurs — le levier d'acquisition passive n°1 (recherches « {groupe}
// comeback 2026 »). Pas de cookies dans ce contexte → client supabase-js nu
// avec la clé anon (tables publiques en lecture via RLS). Exclusions :
// groupes solo (redirect 308 vers /artists) et membres non canoniques
// (redirect) — un sitemap ne doit pas lister de redirections.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const [groupsRes, mvsRes, membersRes] = await Promise.all([
    supabase.from('groups').select('slug').eq('is_solo', false),
    supabase
      .from('events')
      .select('slug, updated_at')
      .eq('type', 'mv')
      .not('slug', 'is', null)
      .range(0, 4999), // cap PostgREST 1000 rows par défaut → fenêtre explicite
    supabase
      .from('members')
      .select('slug')
      .not('slug', 'is', null)
      .is('canonical_id', null)
      .range(0, 1999),
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

  return [...statics, ...groups, ...mvs, ...artists]
}
