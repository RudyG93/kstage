import { createClient } from '@/lib/supabase/server'
import { getRatingsForEvents } from '@/lib/events/community'
import { getGroupSubscriberCounts } from '@/lib/sources/queries'
import { normalize } from '@/lib/scrapers/group-match'

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

/** Tokens de recherche (mots ≥ 2 chars, saisie déjà sanitizée). */
export function tokenize(needle: string): string[] {
  return needle.split(/\s+/).filter((t) => t.length >= 2)
}

/**
 * Sépare les tokens d'une requête entre « tokens groupe » (matchent un nom de
 * groupe : égalité normalisée, ou containment pour les tokens ≥ 4 chars) et
 * « tokens titre » (le reste). Permet « Music Bank aespa » → events d'aespa
 * dont le titre contient music ET bank. Pur, testable.
 */
export function resolveGroupTokens(
  tokens: readonly string[],
  groups: readonly { id: string; name: string }[],
): { groupIds: string[]; titleTokens: string[] } {
  const groupIds = new Set<string>()
  const titleTokens: string[] = []
  for (const token of tokens) {
    const norm = normalize(token)
    if (!norm) continue
    const hits = groups.filter((g) => {
      const name = normalize(g.name)
      return name === norm || (norm.length >= 4 && name.includes(norm))
    })
    if (hits.length > 0) for (const h of hits) groupIds.add(h.id)
    else titleTokens.push(token)
  }
  return { groupIds: [...groupIds], titleTokens }
}

const GROUP_SELECT = 'id, slug, name, agency, image_url, color_hex, is_solo'

// Alias de graphies courantes que la normalisation seule ne couvre pas
// ((G)I-DLE → « gidle » ≠ « idle »). Aligné sur GROUP_ALIASES du scraping.
const SEARCH_ALIASES: Record<string, string> = { gidle: 'idle' }

export async function searchGroups(q: string, limit = 5) {
  const needle = q.trim()
  if (!needle) return []
  const supabase = await createClient()
  // Matching NORMALISÉ en TS, pas un ilike brut : « idle » doit trouver
  // « i-dle » (le tiret cassait le LIKE — retour Rudy 2026-07-12). Même
  // pattern que resolveGroupTokens ; ~112 rows, coût négligeable.
  const [{ data }, subs] = await Promise.all([
    supabase.from('groups').select(GROUP_SELECT),
    getGroupSubscriberCounts(),
  ])
  const norm = normalize(needle)
  if (!norm) return []
  const target = SEARCH_ALIASES[norm] ?? norm
  const rows = (data ?? []).filter((g) => {
    const n = normalize(g.name)
    return n.includes(norm) || n.includes(target) || normalize(g.slug).includes(target)
  })
  // Tri par notoriété (subs YouTube max par groupe) plutôt qu'alphabétique :
  // « les plus connus d'abord » (retour Rudy 2026-07-03).
  return rows.sort((a, b) => (subs.get(b.id) ?? 0) - (subs.get(a.id) ?? 0)).slice(0, limit)
}

export type SearchGroup = Awaited<ReturnType<typeof searchGroups>>[number]

const MV_SELECT = 'id, slug, title, type, start_at, source_url, groups!inner(name, slug)'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

/** Groupes minimaux pour la résolution de tokens (une query, ~114 rows). */
async function allGroupRefs(supabase: SupabaseServer) {
  const { data } = await supabase.from('groups').select('id, name')
  return data ?? []
}

export async function searchMvs(q: string, limit = 6) {
  const needle = sanitizeIlike(q)
  if (!needle) return []
  const supabase = await createClient()
  const tokens = tokenize(needle)
  const { groupIds, titleTokens } = resolveGroupTokens(tokens, await allGroupRefs(supabase))

  type MvRow = {
    id: string
    slug: string | null
    title: string
    type: string
    start_at: string
    source_url: string | null
    groups: { name: string; slug: string } | null
  }
  let rows: MvRow[]
  if (groupIds.length > 0) {
    // Tokens groupe consommés → MVs de ces groupes, filtrés par les tokens
    // titre restants (chaque .ilike chaîné = AND).
    let query = supabase
      .from('events')
      .select(MV_SELECT)
      .eq('type', 'mv')
      .eq('mv_kind', 'main')
      .in('group_id', groupIds)
    for (const t of titleTokens) query = query.ilike('title', `%${t}%`)
    const { data } = await query.order('start_at', { ascending: false }).limit(limit * 2)
    rows = (data ?? []) as MvRow[]
  } else {
    // Pas de groupe reconnu : phrase entière sur le titre OU le nom de groupe
    // (deux passes ilike — pas de `.or()` cross-table).
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
    rows = [...(byTitle.data ?? []), ...(byGroup.data ?? [])].filter((e) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    }) as MvRow[]
  }

  const ratings = await getRatingsForEvents(rows.map((r) => r.id))
  // Mieux notés d'abord (retour Rudy) ; la récence départage et classe les non-notés.
  return rows
    .map((r) => ({ ...r, rating: ratings.get(r.id) ?? null }))
    .sort(
      (a, b) =>
        (b.rating?.avg ?? -1) - (a.rating?.avg ?? -1) || b.start_at.localeCompare(a.start_at),
    )
    .slice(0, limit)
}

export type SearchMv = Awaited<ReturnType<typeof searchMvs>>[number]

const EVENT_SELECT =
  'id, group_id, slug, title, type, start_at, status, episode_number, source_url, stage_url, groups!inner(slug, name, color_hex, image_url, image_landscape, banner_url)'

export async function searchEvents(q: string, limit = 6) {
  const needle = sanitizeIlike(q)
  if (!needle) return []
  const supabase = await createClient()
  const tokens = tokenize(needle)
  const { groupIds, titleTokens } = resolveGroupTokens(tokens, await allGroupRefs(supabase))

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  let query = supabase.from('events').select(EVENT_SELECT).neq('type', 'mv').gte('start_at', since)
  if (groupIds.length > 0) {
    // « Music Bank aespa » → events d'aespa dont le titre contient music ET bank.
    query = query.in('group_id', groupIds)
    for (const t of titleTokens) query = query.ilike('title', `%${t}%`)
  } else {
    query = query.ilike('title', `%${needle}%`)
  }
  const { data } = await query.order('start_at', { ascending: true }).limit(limit)
  return data ?? []
}

export type SearchEvent = Awaited<ReturnType<typeof searchEvents>>[number]
