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
//
// Variables CSS (pas des hex) : les valeurs Midnight en dur (#2FD4AC…)
// faisaient 1.9-2.6:1 sur le thème clair (audit WCAG 2026-07-03). Chaque thème
// résout sa propre valeur ; les fonds translucides passent par color-mix
// (la concaténation `${color}1f` ne marche pas avec var()).
export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  mv: 'var(--teal)',
  release: 'var(--teal)',
  music_show: 'var(--amber)',
  live: 'var(--rose)',
  anniversary: 'var(--faint)',
  concert: 'var(--rose)',
  other: 'var(--faint)',
}

/** Fond translucide d'un tag/chip de type (color-mix — compatible var()). */
export function eventTypeTint(color: string, percent = 12): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`
}

// Types affichés dans les filtres. `concert` retiré (feature abandonnée, 0 donnée) ;
// `live`/`other` restent dans l'enum (données héritées) mais ne sont pas filtrables.
export const FILTERABLE_EVENT_TYPES: EventType[] = ['mv', 'release', 'music_show', 'anniversary']
