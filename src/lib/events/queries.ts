import { createClient } from '@/lib/supabase/server'
import { getKstMonthRange } from './date'
import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

const EVENT_SELECT =
  'id, title, type, start_at, status, groups!inner(slug, name, color_hex, image_url)'

export async function getUpcomingEvents({
  groupSlug,
  type,
  groupIds,
  limit = 50,
}: {
  groupSlug?: string
  type?: EventType
  groupIds?: string[]
  limit?: number
} = {}) {
  const supabase = await createClient()
  let query = supabase
    .from('events')
    .select(EVENT_SELECT)
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(limit)

  if (groupSlug) query = query.eq('groups.slug', groupSlug)
  if (groupIds) query = query.in('group_id', groupIds)
  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getEventsForMonth({
  year,
  month,
  groupSlug,
  type,
}: {
  year: number
  month: number
  groupSlug?: string
  type?: EventType
}) {
  const supabase = await createClient()
  const { startISO, endISO } = getKstMonthRange(year, month)
  let query = supabase
    .from('events')
    .select(EVENT_SELECT)
    .gte('start_at', startISO)
    .lt('start_at', endISO)
    .order('start_at', { ascending: true })

  if (groupSlug) query = query.eq('groups.slug', groupSlug)
  if (type) query = query.eq('type', type)

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
  if (error) throw error
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1)
  }
  return counts
}

export type UpcomingEvent = Awaited<ReturnType<typeof getUpcomingEvents>>[number]
