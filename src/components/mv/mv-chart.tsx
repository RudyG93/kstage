'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { displaySongTitle } from '@/lib/events/title'
import { monthYear } from '@/lib/events/date'
import { faceCrop } from '@/lib/images/cloudinary'
import { cn } from '@/lib/utils'
import type { TopRatedItem, TopRatedPeriod } from '@/lib/events/top-rated'

function DeltaBadge({ delta }: { delta: TopRatedItem['delta'] }) {
  if (delta.kind === 'new')
    return <span className="label-data-inline text-amber w-7 text-right text-[9px]">New</span>
  // « same » ne rend rien (retour Rudy 2026-07-12 : le tiret ne disait rien) —
  // seul « New » (sortie < 7 j) porte un signal.
  if (delta.kind === 'same') return null
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

const PERIODS: { key: TopRatedPeriod; label: string; empty: string }[] = [
  { key: 'month', label: 'Month', empty: 'No rated drops released this month yet.' },
  { key: 'year', label: 'Year', empty: 'No rated drops released this year yet.' },
  { key: 'alltime', label: 'All', empty: 'No rated drops yet.' },
]

// TOP RATED (§7.4.2, périodes 2026-07-11) : rang (n°1 amber), barre de score
// 64×4px gradient primary→teal, badge « New » pour les sorties < 7 j.
// Client : les 3 périodes sont préchargées côté serveur (le volume de notes
// est minuscule), la bascule est instantanée — pas de searchParams, le widget
// reste découplé du tri « Latest drops » de la page.
export function MvChart({
  periods,
  timeZone,
}: {
  periods: Record<TopRatedPeriod, TopRatedItem[]>
  timeZone: string
}) {
  // Défaut : Month dès qu'il porte un vrai chart (≥ 3 entrées), sinon All-time
  // — un chart d'1 item fait vide, un chart vide fait cassé.
  const [active, setActive] = useState<TopRatedPeriod>(
    periods.month.length >= 3 ? 'month' : 'alltime',
  )
  // Rien noté du tout → pas de panneau (un sélecteur sans données ferait faux).
  if (periods.alltime.length === 0) return null
  const items = periods[active]
  const emptyLabel = PERIODS.find((p) => p.key === active)!.empty

  return (
    <Panel>
      <PanelHeader
        label="Top rated"
        right={
          <div
            role="group"
            aria-label="Top rated period"
            className="bg-secondary inline-flex gap-0.5 rounded-md border p-0.5"
          >
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                aria-pressed={active === key}
                className={cn(
                  'label-data-inline rounded-sm px-2 py-1 text-[9px] transition-colors',
                  active === key
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      {items.length === 0 ? (
        <p className="text-muted-foreground px-3 py-6 text-center text-sm">{emptyLabel}</p>
      ) : (
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
                {item.groupImage ? (
                  <Image
                    src={faceCrop(item.groupImage, 48, 48)}
                    alt=""
                    width={24}
                    height={24}
                    unoptimized
                    className="size-6 shrink-0 rounded-sm object-cover"
                    aria-hidden
                  />
                ) : (
                  <span
                    className="gradient-signature flex size-6 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold text-white"
                    aria-hidden
                  >
                    {item.groupName?.[0] ?? '?'}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  {/* Nommage court unifié (R5) : la chanson seule, comme
                      Recent comebacks — plus de « Groupe 'X' Official MV ». */}
                  <span className="block truncate text-xs font-semibold">
                    {displaySongTitle(item.title, item.groupName)}
                  </span>
                  {/* Date de sortie plutôt que le nb de ratings (R6), format
                      mois-année sans apostrophe (R7). */}
                  <span className="text-muted-foreground block truncate text-[10px]">
                    {item.groupName} · {monthYear(item.releaseAt, timeZone)}
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
                {/* Nb de votes visible (audit §8.7 — cumul avec la date R6 :
                    la date reste en sous-titre, le volume qualifie le score). */}
                <span className="tabular text-faint shrink-0 text-[10px]">({item.count})</span>
                <DeltaBadge delta={item.delta} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
