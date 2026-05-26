import { kstToUtcISO } from '@/lib/events/date'
import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

// 'other' exclu du formulaire user (réservé au scraping).
export const SUGGESTABLE_TYPES: EventType[] = [
  'comeback',
  'music_show',
  'live',
  'anniversary',
  'concert',
]
export const MAX_TITLE = 120
export const MAX_DESCRIPTION = 500
export const DAILY_SUGGESTION_CAP = 10

export interface SuggestionInput {
  groupId: string
  type: EventType
  title: string
  startAt: string // UTC ISO
  sourceUrl: string | null
  description: string | null
}

export interface RawSuggestion {
  groupId: string
  type: string
  title: string
  startAtLocal: string // "YYYY-MM-DDTHH:mm" interprété en heure de Séoul (KST)
  sourceUrl: string
  description: string
}

// "YYYY-MM-DDTHH:mm" (horloge KST) → UTC ISO, ou null si invalide.
export function parseKstLocal(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec((local ?? '').trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const hour = Number(m[4])
  const minute = Number(m[5])
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null
  return kstToUtcISO(year, month - 1, day, hour, minute)
}

/** Valide + normalise une saisie user non fiable. */
export function parseSuggestionInput(
  raw: RawSuggestion,
): { error: string } | { value: SuggestionInput } {
  const groupId = (raw.groupId ?? '').trim()
  if (!groupId) return { error: 'Please choose a group.' }

  if (!SUGGESTABLE_TYPES.includes(raw.type as EventType)) return { error: 'Invalid event type.' }
  const type = raw.type as EventType

  const title = (raw.title ?? '').trim()
  if (!title) return { error: 'Title is required.' }
  if (title.length > MAX_TITLE) return { error: `Title must be ${MAX_TITLE} characters or fewer.` }

  const startAt = parseKstLocal(raw.startAtLocal)
  if (!startAt) return { error: 'Please provide a valid date and time.' }

  const sourceUrlRaw = (raw.sourceUrl ?? '').trim()
  if (sourceUrlRaw && !/^https?:\/\/.+/i.test(sourceUrlRaw)) {
    return { error: 'Source URL must start with http:// or https://.' }
  }
  const sourceUrl = sourceUrlRaw || null

  const descTrimmed = (raw.description ?? '').trim()
  const description = descTrimmed ? descTrimmed.slice(0, MAX_DESCRIPTION) : null

  return { value: { groupId, type, title, startAt, sourceUrl, description } }
}
