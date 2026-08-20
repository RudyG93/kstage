import { RailStack } from '@/components/rails/rail-stack'
import { RecentComebacksBlock } from '@/components/rails/event-blocks'
import {
  BirthdaysBlock,
  DiscussionsBlock,
  TopRatedBlock,
} from '@/components/rails/community-blocks'

/**
 * Composition de rail droit de la HOME (et repli des pages détail sans rail
 * contextuel). Recomposée au Lot 6 (2026-08-20) : les blocs vivent dans
 * `components/rails/` et chaque page empile les siens — ce fichier n'est plus
 * LE rail unique de l'app. Ici : sorties récentes (miroir passé du « Next
 * up » central), top notes (seule surface où le module notation est visible
 * hors /mvs), anniversaires des groupes suivis, discussions.
 */
export function SidebarRight() {
  return (
    <RailStack>
      <RecentComebacksBlock />
      <TopRatedBlock />
      <BirthdaysBlock />
      <DiscussionsBlock />
    </RailStack>
  )
}
