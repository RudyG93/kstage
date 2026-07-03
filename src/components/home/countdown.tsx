'use client'

import { useEffect, useState } from 'react'
import { useHydrated } from '@/hooks/use-hydrated'
import { cn } from '@/lib/utils'

function partsMs(targetIso: string) {
  const diff = Math.max(0, new Date(targetIso).getTime() - Date.now())
  const totalSec = Math.floor(diff / 1000)
  return {
    days: Math.floor(totalSec / 86_400),
    hours: Math.floor((totalSec % 86_400) / 3600),
    min: Math.floor((totalSec % 3600) / 60),
    sec: totalSec % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Countdown Data Desk (§7.1.3, §8) — tick 1s, chiffres Space Grotesk zéro-paddés.
 * - `cells` (défaut) : 4 cellules D/H/M/S, secondes en primary (hero, landing).
 * - `inline` : « in 07:22:14 » teal (listes du calendrier).
 */
export function Countdown({
  targetIso,
  variant = 'cells',
}: {
  targetIso: string
  variant?: 'cells' | 'inline'
}) {
  const hydrated = useHydrated()
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const p = partsMs(targetIso)

  if (variant === 'inline') {
    const hoursTotal = p.days * 24 + p.hours
    return (
      <span className="tabular text-teal text-xs font-semibold">
        {hydrated ? `in ${pad(hoursTotal)}:${pad(p.min)}:${pad(p.sec)}` : 'soon'}
      </span>
    )
  }

  const cells = [
    { value: p.days, label: 'D' },
    { value: p.hours, label: 'H' },
    { value: p.min, label: 'M' },
    { value: p.sec, label: 'S', accent: true },
  ]

  return (
    <div className="flex gap-1.5">
      {cells.map((c) => (
        <div
          key={c.label}
          className="bg-background/60 flex w-[49px] flex-col items-center rounded-[8px] border py-1.5"
        >
          <span
            className={cn(
              'tabular text-[21px] leading-none font-bold',
              c.accent ? 'text-primary' : 'text-foreground',
            )}
          >
            {hydrated ? pad(c.value) : '--'}
          </span>
          <span className="label-data-inline text-faint mt-1 text-[7.5px]">{c.label}</span>
        </div>
      ))}
    </div>
  )
}
