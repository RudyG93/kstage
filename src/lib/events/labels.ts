import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  comeback: 'Comeback',
  music_show: 'Music Show',
  live: 'Live',
  anniversary: 'Anniversary',
  concert: 'Concert',
  other: 'Other',
}

// Types couverts au MVP (cf. PROJECT.md §2), utilisés pour le filtre.
export const FILTERABLE_EVENT_TYPES: EventType[] = ['comeback', 'music_show', 'live', 'anniversary']
