import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

/**
 * En dessous, une moyenne n'est pas un score : c'est l'avis d'UNE personne
 * présenté comme un score. Partagé par la page MV et la vignette MvCard —
 * sinon la carte promet « ★ 8.5 · 1 » et la page qu'elle ouvre n'affiche plus
 * rien (constaté à la revue du 2026-08-23).
 *
 * Ici et pas dans `community.ts` : ce dernier importe le client Supabase
 * serveur (`next/headers`), et MvCard vit dans le graphe CLIENT via
 * CollapsibleMvs — l'import faisait échouer le build.
 */
export const MIN_RATINGS_SHOWN = 3

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

/**
 * Fond translucide d'un tag/chip de type (color-mix — compatible var()).
 *
 * 8 % et non 12 % : le fond est teinté avec le MÊME jeton que le texte posé
 * dessus, donc chaque point de teinte mange du contraste. À 12 %, un tag
 * « Anniversary » (`--faint`) tombait à 4.42:1 en thème sombre — sous les
 * 4.5:1 exigés à 9 px. Mesuré sur les couleurs réelles : à 8 % il remonte à
 * 4.67, et les autres jetons y gagnent aussi (rose 4.92 → 5.18, amber 7.21 →
 * 7.77, teal 8.83 → 9.74).
 */
export function eventTypeTint(color: string, percent = 8): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`
}

// Types affichés dans les filtres. `concert` retiré (feature abandonnée, 0 donnée) ;
// `live`/`other` restent dans l'enum (données héritées) mais ne sont pas filtrables.
export const FILTERABLE_EVENT_TYPES: EventType[] = ['mv', 'release', 'music_show', 'anniversary']
