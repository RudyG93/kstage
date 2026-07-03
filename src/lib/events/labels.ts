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

// Data Desk : jeu réduit lisible en clair ET sombre (décision 2026-07-03,
// supersède « mv ≠ release ») : teal = sortie musicale (mv + release, la
// distinction reste portée par les tags texte), ambre = music show,
// rose = live/concert, neutre = anniversary/other.
export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  mv: '#2FD4AC',
  release: '#2FD4AC',
  music_show: '#E3A83C',
  live: '#E85D8A',
  anniversary: '#8b90a3',
  concert: '#E85D8A',
  other: '#8b90a3',
}

// Types affichés dans les filtres. `concert` retiré (feature abandonnée, 0 donnée) ;
// `live`/`other` restent dans l'enum (données héritées) mais ne sont pas filtrables.
export const FILTERABLE_EVENT_TYPES: EventType[] = ['mv', 'release', 'music_show', 'anniversary']
