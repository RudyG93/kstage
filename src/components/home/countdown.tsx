'use client'

import { useEffect, useState } from 'react'
import { useHydrated } from '@/hooks/use-hydrated'

function format(targetIso: string): string {
  const diff = new Date(targetIso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const totalMinutes = Math.floor(diff / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m`
}

export function Countdown({ targetIso }: { targetIso: string }) {
  const hydrated = useHydrated()
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="text-right">
      <div className="font-mono text-4xl tracking-tight tabular-nums">
        {hydrated ? format(targetIso) : '--d --h --m'}
      </div>
      <div className="text-muted-foreground mt-1 text-xs">until release</div>
    </div>
  )
}
