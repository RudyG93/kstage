import { Star } from 'lucide-react'
import { Panel } from '@/components/ui/panel'
import { ShareButton } from '@/components/share-button'
import { cn } from '@/lib/utils'

// FAN CARD (§7.8.3) — le « CV de fan » : border primary/30, gradient
// primary→teal, filigrane K, 4 stats, ligne ult/bias. SHARE = partage natif /
// copie du lien (la génération d'image = backlog « Wrapped »).
export function FanCard({
  year,
  username,
  following,
  rated,
  avg,
  likes,
  ultGroup,
  bias,
}: {
  year: number
  username: string
  following: number
  rated: number
  avg: number | null
  likes: number
  ultGroup: string | null
  bias: string | null
}) {
  return (
    <Panel className="border-primary/30 relative">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(130deg, color-mix(in srgb, var(--primary) 16%, transparent), color-mix(in srgb, var(--teal) 7%, transparent) 60%, transparent)',
        }}
        aria-hidden
      />
      <span
        className="font-heading pointer-events-none absolute -top-5 right-1 text-[100px] leading-none font-extrabold opacity-[0.06] select-none"
        aria-hidden
      >
        K
      </span>
      <div className="relative space-y-3 p-3.5">
        <div className="flex items-center justify-between">
          <span className="label-data">Fan card — {year}</span>
          <ShareButton title={`${username} on KStage`} className="size-7 bg-transparent" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Following" value={String(following)} />
          <Stat label="Rated" value={String(rated)} />
          <Stat label="Avg" value={avg !== null ? avg.toFixed(1) : '—'} accent="text-amber" />
          <Stat label="Likes" value={String(likes)} accent="text-rose" />
        </div>
        {(ultGroup || bias) && (
          <p className="text-muted-foreground flex items-center gap-1 border-t pt-2.5 text-xs">
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
      </div>
    </Panel>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn('tabular text-lg leading-none font-bold', accent)}>{value}</span>
      <span className="label-data-inline text-faint text-[8px]">{label}</span>
    </div>
  )
}
