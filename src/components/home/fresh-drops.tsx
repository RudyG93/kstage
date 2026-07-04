import { Panel, PanelHeader } from '@/components/ui/panel'
import { MvCard, type Rating } from '@/components/group/mv-card'
import type { MvEvent } from '@/lib/events/queries'

// FRESH DROPS — RATE THEM (§7.1.6) : grille 2 col de MvCard avec chip RATE.
// Le différenciateur notes/commentaires mis au centre de la home.
export function FreshDrops({
  mvs,
  ratings,
}: {
  mvs: readonly MvEvent[]
  ratings: Map<string, Rating>
}) {
  if (mvs.length === 0) return null
  return (
    <Panel className="overflow-visible">
      <PanelHeader label="Fresh drops — rate them" action={{ label: 'All drops', href: '/mvs' }} />
      <div className="grid grid-cols-2 gap-[9px] p-3">
        {mvs.map((mv) => (
          <MvCard
            key={mv.id}
            mv={mv}
            rating={ratings.get(mv.id) ?? { avg: 0, count: 0 }}
            showRateChip
          />
        ))}
      </div>
    </Panel>
  )
}
