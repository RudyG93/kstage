import { Panel, PanelHeader } from '@/components/ui/panel'
import { cn } from '@/lib/utils'

// Bloc stats du profil : panneau sobre, 4 stats. La ligne texte « Ult group …
// · bias … » a été retirée (2026-07-12, retour Rudy) : les pickers Favorite/
// Bias juste en dessous montrent déjà ces infos visuellement.
export function ProfileStats({
  following,
  rated,
  avg,
  likes,
}: {
  following: number
  rated: number
  avg: number | null
  likes: number
}) {
  return (
    <Panel>
      <PanelHeader label="Stats" />
      <div className="grid grid-cols-4 items-stretch divide-x">
        <Stat label="Following" value={String(following)} />
        <Stat label="Rated" value={String(rated)} />
        <Stat label="Avg" value={avg !== null ? avg.toFixed(1) : '—'} accent="text-amber" />
        <Stat label="Likes" value={String(likes)} accent="text-rose" />
      </div>
    </Panel>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex min-h-[56px] flex-col items-center justify-center gap-1 p-2.5">
      <span className={cn('tabular text-lg leading-none font-bold', accent)}>{value}</span>
      <span className="label-data-inline text-faint text-[8px]">{label}</span>
    </div>
  )
}
