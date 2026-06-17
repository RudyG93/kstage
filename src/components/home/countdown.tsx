'use client'

import { useEffect, useState } from 'react'
import { useHydrated } from '@/hooks/use-hydrated'
import { cn } from '@/lib/utils'

function parts(targetIso: string) {
  const diff = new Date(targetIso).getTime() - Date.now()
  const total = Math.max(0, Math.floor(diff / 60_000))
  return [
    { value: Math.floor(total / 1440), label: 'days' },
    { value: Math.floor((total % 1440) / 60), label: 'hrs' },
    { value: total % 60, label: 'min' },
  ]
}

const pad = (n: number) => String(n).padStart(2, '0')

// Countdown en 3 blocs chiffrés (maquette KStage Home) : jours / heures / min,
// Space Grotesk, premier bloc en accent primary. Tick chaque minute.
export function Countdown({ targetIso }: { targetIso: string }) {
  const hydrated = useHydrated()
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const units = parts(targetIso)

  return (
    <div className="flex items-start gap-4">
      {units.map((u, i) => (
        <div key={u.label} className="text-center">
          <div
            className={cn(
              'tabular text-3xl leading-none font-bold tabular-nums',
              i === 0 ? 'text-primary' : 'text-foreground',
            )}
          >
            {hydrated ? pad(u.value) : '--'}
          </div>
          <div className="text-faint mt-1.5 text-[10px]">{u.label}</div>
        </div>
      ))}
    </div>
  )
}
