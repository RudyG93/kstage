import { FILTERABLE_EVENT_TYPES } from './labels'
import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

const FILTERABLE_SET = new Set<EventType>(FILTERABLE_EVENT_TYPES)

/**
 * Parse the `?type=` URL param (CSV) into a validated EventType[].
 * Unknown or non-filterable values are silently dropped so a stale link
 * never crashes the query.
 */
export function parseTypesParam(raw: string | undefined): EventType[] {
  if (!raw) return []
  const out: EventType[] = []
  for (const token of raw.split(',')) {
    const t = token.trim() as EventType
    if (t && FILTERABLE_SET.has(t) && !out.includes(t)) out.push(t)
  }
  return out
}

/** Serialize a set of types back into a CSV value for the URL. */
export function serializeTypesParam(types: readonly EventType[]): string {
  return types.join(',')
}
