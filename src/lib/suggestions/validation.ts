import { kstToUtcISO } from '@/lib/events/date'
import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

// Types suggérables par la communauté. `anniversary` est exclu (généré
// automatiquement depuis les dates de naissance/début) ; `live`/`other` aussi.
export const SUGGESTABLE_TYPES: EventType[] = ['mv', 'release', 'music_show', 'concert']
export const MAX_TITLE = 120
export const MAX_DESCRIPTION = 2000
export const DAILY_SUGGESTION_CAP = 10

export type SuggestionKind = 'new' | 'fix'

export interface NewSuggestionInput {
  kind: 'new'
  groupId: string
  type: EventType
  title: string
  startAt: string // UTC ISO
  sourceUrl: string | null
  description: string | null
}

export interface FixSuggestionInput {
  kind: 'fix'
  targetEventId: string
  description: string // ce qui est faux — obligatoire pour un fix
  sourceUrl: string | null
}

export type SuggestionInput = NewSuggestionInput | FixSuggestionInput

export interface RawSuggestion {
  kind?: string
  groupId?: string
  type?: string
  title?: string
  startAtLocal?: string // "YYYY-MM-DDTHH:mm" interprété en heure de Séoul (KST)
  sourceUrl?: string
  description?: string
  targetEventId?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

function parseSourceUrl(raw: string | undefined): { error: string } | { value: string | null } {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { value: null }
  if (!/^https?:\/\/.+/i.test(trimmed)) {
    return { error: 'Source URL must start with http:// or https://.' }
  }
  return { value: trimmed }
}

/** Valide + normalise une saisie user non fiable. Dispatch sur `kind`. */
export function parseSuggestionInput(
  raw: RawSuggestion,
): { error: string } | { value: SuggestionInput } {
  const kind = (raw.kind ?? 'new').trim() as SuggestionKind
  if (kind === 'fix') return parseFixInput(raw)
  if (kind === 'new') return parseNewInput(raw)
  return { error: 'Invalid suggestion kind.' }
}

function parseNewInput(raw: RawSuggestion): { error: string } | { value: NewSuggestionInput } {
  const groupId = (raw.groupId ?? '').trim()
  if (!groupId) return { error: 'Please choose a group.' }

  if (!SUGGESTABLE_TYPES.includes(raw.type as EventType)) return { error: 'Invalid event type.' }
  const type = raw.type as EventType

  const title = (raw.title ?? '').trim()
  if (!title) return { error: 'Title is required.' }
  if (title.length > MAX_TITLE) return { error: `Title must be ${MAX_TITLE} characters or fewer.` }

  const startAt = parseKstLocal(raw.startAtLocal ?? '')
  if (!startAt) return { error: 'Please provide a valid date and time.' }

  const sourceUrl = parseSourceUrl(raw.sourceUrl)
  if ('error' in sourceUrl) return { error: sourceUrl.error }

  const descTrimmed = (raw.description ?? '').trim()
  const description = descTrimmed ? descTrimmed.slice(0, MAX_DESCRIPTION) : null

  return {
    value: {
      kind: 'new',
      groupId,
      type,
      title,
      startAt,
      sourceUrl: sourceUrl.value,
      description,
    },
  }
}

function parseFixInput(raw: RawSuggestion): { error: string } | { value: FixSuggestionInput } {
  const targetEventId = (raw.targetEventId ?? '').trim()
  if (!targetEventId) return { error: 'Please pick the event you want to fix.' }
  if (!UUID_RE.test(targetEventId)) return { error: 'Invalid event reference.' }

  const descTrimmed = (raw.description ?? '').trim()
  if (!descTrimmed) return { error: 'Describe what is incorrect.' }

  const sourceUrl = parseSourceUrl(raw.sourceUrl)
  if ('error' in sourceUrl) return { error: sourceUrl.error }

  return {
    value: {
      kind: 'fix',
      targetEventId,
      description: descTrimmed.slice(0, MAX_DESCRIPTION),
      sourceUrl: sourceUrl.value,
    },
  }
}
