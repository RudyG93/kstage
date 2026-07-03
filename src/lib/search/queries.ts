import { createClient } from '@/lib/supabase/server'
import { getRatingsForEvents } from '@/lib/events/community'

/**
 * Échappe une saisie user pour un `.ilike()` PostgREST : neutralise les
 * wildcards `%`/`_` et retire les virgules (elles cassent les chaînes `.or()`).
 */
export function sanitizeIlike(q: string): string {
  return q
    .replace(/,/g, ' ')
    .replace(/[\\%_]/g, (m) => `\\${m}`)
    .trim()
    .slice(0, 80)
}

const GROUP_SELECT = 'id, slug, name, agency, image_url, color_hex, is_solo'

export async function searchGroups(q: string, limit = 5) {
  const needle = sanitizeIlike(q)
  if (!needle) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('groups')
    .select(GROUP_SELECT)
    .ilike('name', `%${needle}%`)
    .order('name')
    .limit(limit)
  return data ?? []
}

export type SearchGroup = Awaited<ReturnType<typeof searchGroups>>[number]

const MV_SELECT = 'id, slug, title, type, start_at, source_url, groups!inner(name, slug)'

export async function searchMvs(q: string, limit = 6) {
  const needle = sanitizeIlike(q)
  if (!needle) return []
  const supabase = await createClient()
  // Deux passes ilike (titre OU nom de groupe) — pas de `.or()` cross-table.
  const [byTitle, byGroup] = await Promise.all([
    supabase
      .from('events')
      .select(MV_SELECT)
      .eq('type', 'mv')
      .eq('mv_kind', 'main')
      .ilike('title', `%${needle}%`)
      .order('start_at', { ascending: false })
      .limit(limit),
    supabase
      .from('events')
      .select(MV_SELECT)
      .eq('type', 'mv')
      .eq('mv_kind', 'main')
      .ilike('groups.name', `%${needle}%`)
      .order('start_at', { ascending: false })
      .limit(limit),
  ])
  const seen = new Set<string>()
  const merged = [...(byTitle.data ?? []), ...(byGroup.data ?? [])].filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
  const results = merged.slice(0, limit)
  const ratings = await getRatingsForEvents(results.map((r) => r.id))
  return results.map((r) => ({ ...r, rating: ratings.get(r.id) ?? null }))
}

export type SearchMv = Awaited<ReturnType<typeof searchMvs>>[number]

const EVENT_SELECT =
  'id, group_id, slug, title, type, start_at, status, episode_number, source_url, groups!inner(slug, name, color_hex, image_url, image_landscape, banner_url)'

export async function searchEvents(q: string, limit = 6) {
  const needle = sanitizeIlike(q)
  if (!needle) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .neq('type', 'mv')
    .ilike('title', `%${needle}%`)
    .gte('start_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
    .order('start_at', { ascending: true })
    .limit(limit)
  return data ?? []
}

export type SearchEvent = Awaited<ReturnType<typeof searchEvents>>[number]
