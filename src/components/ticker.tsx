import { cn } from '@/lib/utils'
import type { TickerItem } from '@/lib/events/ticker'

// Bande live 30px (§7.1.2) — marquee CSS pur : contenu ×2, translateX 0→−50%,
// pause au hover, statique si prefers-reduced-motion. Server component.
export function Ticker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null

  const row = (ariaHidden: boolean) => (
    <div
      className="flex shrink-0 items-center gap-7 pr-7"
      {...(ariaHidden ? { 'aria-hidden': true } : {})}
    >
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2 whitespace-nowrap">
          <span
            className={cn(
              'size-[5px] shrink-0 rounded-full',
              item.live ? 'bg-live animate-live-pulse' : 'bg-primary animate-upcoming-pulse',
            )}
            aria-hidden
          />
          <span className="label-data text-foreground/80">{item.text}</span>
        </span>
      ))}
    </div>
  )

  return (
    <div className="bg-page flex h-[30px] items-center overflow-hidden border-y">
      <div className="animate-marquee flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}
