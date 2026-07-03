import Link from 'next/link'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { cn } from '@/lib/utils'
import type { TopRatedItem } from '@/lib/events/top-rated'

function DeltaBadge({ delta }: { delta: TopRatedItem['delta'] }) {
  if (delta.kind === 'new')
    return <span className="label-data-inline text-amber w-7 text-right text-[9px]">New</span>
  if (delta.kind === 'same') return <span className="text-faint w-7 text-right text-[10px]">—</span>
  const up = delta.kind === 'up'
  return (
    <span
      className={cn(
        'tabular w-7 text-right text-[10px] font-semibold',
        up ? 'text-teal' : 'text-rose',
      )}
    >
      {up ? '▲' : '▼'}
      {delta.n}
    </span>
  )
}

// TOP RATED — THIS WEEK (§7.4.2) : rang (n°1 amber), barre de score 64×4px
// gradient primary→teal, delta de rang. Server component.
export function MvChart({ items, scope }: { items: TopRatedItem[]; scope: 'week' | 'alltime' }) {
  if (items.length === 0) return null
  return (
    <Panel>
      <PanelHeader
        label={scope === 'week' ? 'Top rated — this week' : 'Top rated — all time'}
        action={{ label: 'All MVs', href: '/mvs' }}
      />
      <ol>
        {items.map((item, i) => (
          <li key={item.eventId} className="border-b last:border-b-0">
            <Link
              href={item.slug ? `/mv/${item.slug}` : '/mvs'}
              className="hover:bg-secondary/60 flex min-h-[44px] items-center gap-2.5 px-3 py-2 transition-colors"
            >
              <span
                className={cn(
                  'tabular w-5 shrink-0 text-[13px] font-bold',
                  i === 0 ? 'text-amber' : 'text-muted-foreground',
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{item.title}</span>
                <span className="text-muted-foreground block truncate text-[10px]">
                  {item.groupName} · {item.count} rating{item.count === 1 ? '' : 's'}
                </span>
              </span>
              <span className="bg-foreground/8 h-[4px] w-16 shrink-0 overflow-hidden rounded-full">
                <span
                  className="gradient-signature block h-full rounded-full"
                  style={{ width: `${item.avg * 10}%` }}
                />
              </span>
              <span className="tabular w-8 shrink-0 text-right text-[12.5px] font-bold">
                {item.avg.toFixed(1)}
              </span>
              <DeltaBadge delta={item.delta} />
            </Link>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
