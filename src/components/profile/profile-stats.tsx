import { Star } from 'lucide-react'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { cn } from '@/lib/utils'

// Bloc stats du profil : panneau sobre (4 stats + ligne ult/bias). Remplace
// l'ancienne « fan card » gradient/partage (retirée à la demande de Rudy).
export function ProfileStats({
  following,
  rated,
  avg,
  likes,
  ultGroup,
  bias,
}: {
  following: number
  rated: number
  avg: number | null
  likes: number
  ultGroup: string | null
  bias: string | null
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
      {(ultGroup || bias) && (
        <p className="text-muted-foreground flex items-center gap-1 border-t px-3 py-2.5 text-xs">
          {ultGroup && (
            <span>
              Ult group <span className="text-foreground font-semibold">{ultGroup}</span>
            </span>
          )}
          {ultGroup && bias && <span aria-hidden> · </span>}
          {bias && (
            <span className="inline-flex items-center gap-1">
              bias <span className="text-foreground font-semibold">{bias}</span>
              <Star className="fill-amber text-amber size-3" aria-hidden />
            </span>
          )}
        </p>
      )}
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
