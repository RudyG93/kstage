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

// Thème Daylight/Midnight : un jeu unique lisible en clair ET sombre. Chaque
// type a SA couleur (mv ≠ release, sinon on s'y perd) : mv = teal (clip vidéo),
// release = periwinkle (audio/album), music_show = ambre, live = rose,
// anniversary/other = neutre.
export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  mv: '#20bfae',
  release: '#6d6bf2',
  music_show: '#d49830',
  live: '#e85d8a',
  anniversary: '#8b90a3',
  concert: '#8b90a3',
  other: '#8b90a3',
}

// Types affichés dans les filtres. `concert` retiré (feature abandonnée, 0 donnée) ;
// `live`/`other` restent dans l'enum (données héritées) mais ne sont pas filtrables.
export const FILTERABLE_EVENT_TYPES: EventType[] = ['mv', 'release', 'music_show', 'anniversary']
