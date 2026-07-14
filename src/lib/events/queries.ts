import { createClient } from '@/lib/supabase/server'
import { getKstMonthRange } from './date'
import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

const EVENT_SELECT =
  'id, group_id, slug, title, type, start_at, status, episode_number, source_url, stage_url, groups!inner(slug, name, color_hex, image_url, image_landscape, banner_url)'

// Predicate appliqué partout sauf getGroupMvs (cf. matrice §8 SCRAPING.md) :
// les MVs `main` + les non-MV (mv_kind=NULL) sont visibles. Les versions
// performance/member/other_version sont filtrées.
// Exporté pour les contextes sans cookies (feed iCal service-role).
export const isMainOrNonMv = 'mv_kind.eq.main,mv_kind.is.null'

export async function getUpcomingEvents({
  groupSlug,
  types,
  groupIds,
  limit = 50,
}: {
  groupSlug?: string
  types?: readonly EventType[]
  groupIds?: string[]
  limit?: number
} = {}) {
  const supabase = await createClient()
  let query = supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('hidden', false)
    .gte('start_at', new Date().toISOString())
    .or(isMainOrNonMv)
    .order('start_at', { ascending: true })
    .limit(limit)

  if (groupSlug) query = query.eq('groups.slug', groupSlug)
  if (groupIds) query = query.in('group_id', groupIds)
  if (types && types.length > 0) query = query.in('type', types as EventType[])

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Nombre d'events (toutes dates et types confondus) par group_id — proxy « ce
 * groupe a-t-il du contenu réel » (events à venir ou catalogue MV passé). Sert à
 * piloter les surfaces de promotion (onboarding P0.6) vers les groupes au
 * calendrier non vide, sans figer la sélection sur les seuls follows (≈ 0 sur un
 * compte neuf). Les anniversaires (générés à la volée) ne comptent pas : ils sont
 * du contenu plancher, pas un critère de mise en avant.
 */
export async function getGroupEventCounts(): Promise<Map<string, number>> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('events').select('group_id')
  if (error) throw error
  const counts = new Map<string, number>()
  for (const e of data ?? []) {
    if (!e.group_id) continue
    counts.set(e.group_id, (counts.get(e.group_id) ?? 0) + 1)
  }
  return counts
}

export async function getEventsForMonth({
  year,
  month,
  groupSlugs,
  types,
}: {
  year: number
  month: number
  groupSlugs?: string[]
  types?: readonly EventType[]
}) {
  const supabase = await createClient()
  const { startISO, endISO } = getKstMonthRange(year, month)
  let query = supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('hidden', false)
    .gte('start_at', startISO)
    .lt('start_at', endISO)
    .or(isMainOrNonMv)
    .order('start_at', { ascending: true })

  if (groupSlugs && groupSlugs.length > 0) query = query.in('groups.slug', groupSlugs)
  if (types && types.length > 0) query = query.in('type', types as EventType[])

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getUpcomingEventCountsByGroup(
  groupIds: string[],
): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('group_id')
    .in('group_id', groupIds)
    .gte('start_at', new Date().toISOString())
    .or(isMainOrNonMv)
  if (error) throw error
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1)
  }
  return counts
}

export async function getRecentComebacks(limit = 3) {
  // mv_kind='main' uniquement : la sidebar Recent comebacks doit montrer le
  // clip principal, pas les versions Performance/Member/Other (cf. matrice
  // de visibilité §8 SCRAPING.md).
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, slug, type, title, start_at, image_url, groups!inner(name, slug)')
    .eq('type', 'mv')
    .eq('mv_kind', 'main')
    .eq('hidden', false)
    .lt('start_at', new Date().toISOString())
    .order('start_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

const MV_SELECT =
  'id, slug, title, type, start_at, source_url, image_url, mv_kind, groups!inner(slug, name, color_hex, image_url)'

/**
 * Tous les MVs d'un groupe (passés inclus), pour la section "Music videos"
 * de la page /groups/[slug]. Garde main + performance (versions de groupe) ;
 * exclut member (réservé à /artists/[slug]) et other_version.
 */
export async function getGroupMvs(slug: string, limit = 48) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select(MV_SELECT)
    .eq('groups.slug', slug)
    .eq('type', 'mv')
    .in('mv_kind', ['main', 'performance'])
    .eq('hidden', false)
    .order('start_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/**
 * MVs SOLO d'un membre (mv_kind='member', member_id) — surfacés sur sa page
 * /artists/[slug] (R10). Ces MVs étaient collectés mais jamais affichés
 * (getGroupMvs les exclut, la branche membre ne les requêtait pas).
 */
export async function getMemberMvs(memberId: string, limit = 24) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select(MV_SELECT)
    .eq('member_id', memberId)
    .eq('type', 'mv')
    .eq('mv_kind', 'member')
    .eq('hidden', false)
    .order('start_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/**
 * Liste globale des MVs (main only), optionnellement restreinte à un set de
 * groupes (utilisé pour la section "From your groups" sur /mvs).
 */
export async function getAllMvs(options: { groupIds?: string[]; limit?: number } = {}) {
  const { groupIds, limit = 100 } = options
  const supabase = await createClient()
  let query = supabase
    .from('events')
    .select(MV_SELECT)
    .eq('type', 'mv')
    .eq('mv_kind', 'main')
    .eq('hidden', false)
    .order('start_at', { ascending: false })
    .limit(limit)
  if (groupIds && groupIds.length > 0) query = query.in('group_id', groupIds)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/** Nombre total d'events suivis (proof bar de la landing §7.9). Head-only. */
export async function getEventsCount(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase.from('events').select('id', { count: 'exact', head: true })
  return count ?? 0
}

/**
 * Prochain event (futur) par groupe — ligne statut des tuiles Groups et
 * contexte du panneau Trending (Data Desk §7.5). Un fetch, réduction en TS.
 */
export async function getNextEventForGroups(
  groupIds: string[],
): Promise<Map<string, { type: EventType; start_at: string; title: string }>> {
  const out = new Map<string, { type: EventType; start_at: string; title: string }>()
  if (groupIds.length === 0) return out
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('group_id, type, start_at, title')
    .in('group_id', groupIds)
    .eq('hidden', false)
    .gte('start_at', new Date().toISOString())
    .or(isMainOrNonMv)
    .order('start_at', { ascending: true })
  if (error) throw error
  for (const e of data ?? []) {
    if (!e.group_id || out.has(e.group_id)) continue
    out.set(e.group_id, { type: e.type, start_at: e.start_at, title: e.title })
  }
  return out
}

/**
 * Dernière sortie RÉCENTE (mv main ou release ≤ `days` jours) par groupe —
 * signal « recency » du panneau Trending (2026-07-11). Un fetch, réduction TS.
 */
export async function getRecentReleasesForGroups(
  groupIds: string[],
  days = 30,
): Promise<Map<string, { type: EventType; start_at: string; title: string }>> {
  const out = new Map<string, { type: EventType; start_at: string; title: string }>()
  if (groupIds.length === 0) return out
  const supabase = await createClient()
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('events')
    .select('group_id, type, start_at, title')
    .in('group_id', groupIds)
    .in('type', ['mv', 'release'])
    .eq('hidden', false)
    .or(isMainOrNonMv)
    .gte('start_at', since)
    .lte('start_at', new Date().toISOString())
    .order('start_at', { ascending: false })
  if (error) throw error
  for (const e of data ?? []) {
    if (!e.group_id || out.has(e.group_id)) continue
    out.set(e.group_id, { type: e.type, start_at: e.start_at, title: e.title })
  }
  return out
}

export type UpcomingEvent = Awaited<ReturnType<typeof getUpcomingEvents>>[number]
export type RecentComeback = Awaited<ReturnType<typeof getRecentComebacks>>[number]
export type MvEvent = Awaited<ReturnType<typeof getGroupMvs>>[number]

/** MVs likés par un user (table mv_like), du plus récent au plus ancien. */
export async function getLikedMvs(userId: string, limit = 30): Promise<MvEvent[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mv_like')
    .select(`created_at, event:events!inner(${MV_SELECT})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => (r as unknown as { event: MvEvent }).event)
}

/**
 * Entités les plus récemment commentées (format "forum-like", §7.2), triées par
 * date du dernier commentaire, avec le nombre de commentaires. Agrégation JS
 * bornée (fenêtre des 300 derniers commentaires) — suffisant pour une sidebar et
 * évite un RPC dédié. Les commentaires vivent sur les pages MV → liens internes.
 */
export async function getRecentlyCommentedEvents(limit = 12) {
  const supabase = await createClient()
  const { data: recent, error } = await supabase
    .from('comments')
    .select('event_id, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error

  // Ordre desc déjà appliqué → la 1re occurrence d'un event = son dernier commentaire.
  const lastByEvent = new Map<string, string>()
  for (const c of recent ?? []) {
    if (!lastByEvent.has(c.event_id)) lastByEvent.set(c.event_id, c.created_at)
  }
  const ids = [...lastByEvent.keys()].slice(0, limit)
  if (ids.length === 0) return []

  const [eventsRes, countsRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, slug, title, type, image_url, source_url, groups!inner(slug, name)')
      .in('id', ids),
    supabase.from('comments').select('event_id').is('deleted_at', null).in('event_id', ids),
  ])
  const countByEvent = new Map<string, number>()
  for (const r of countsRes.data ?? []) {
    countByEvent.set(r.event_id, (countByEvent.get(r.event_id) ?? 0) + 1)
  }
  const eventById = new Map((eventsRes.data ?? []).map((e) => [e.id, e]))

  return ids.flatMap((id) => {
    const e = eventById.get(id)
    if (!e) return []
    return [{ ...e, commentCount: countByEvent.get(id) ?? 0, lastCommentAt: lastByEvent.get(id)! }]
  })
}

export type CommentedEvent = Awaited<ReturnType<typeof getRecentlyCommentedEvents>>[number]
