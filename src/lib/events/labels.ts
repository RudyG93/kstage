import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  mv: 'MV',
  release: 'Release',
  music_show: 'Music Show',
  live: 'Live',
  anniversary: 'Anniversary',
  concert: 'Concert',
  other: 'Other',
}

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  mv: '#ff5ca8',
  release: '#2dd4bf',
  music_show: '#f5c542',
  live: '#5bc0ff',
  anniversary: '#cdb4ff',
  concert: '#fb923c',
  other: '#9aa0a6',
}

// Types affichés dans les filtres. `live` et `other` restent dans l'enum
// (données héritées) mais ne sont pas filtrables.
export const FILTERABLE_EVENT_TYPES: EventType[] = [
  'mv',
  'release',
  'music_show',
  'concert',
  'anniversary',
]
