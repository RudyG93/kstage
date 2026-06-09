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

// Format court pour les cartes de comebacks (§5) : « in 3d », « in 5h ». Renvoie
// null si l'event est passé ou trop loin (≥ 14 j) → le badge ne s'affiche pas
// (un « in 120d » serait du bruit). Helper isolé : le calcul impur (Date.now)
// reste hors du corps de composant (règle react-hooks/purity).
function formatShort(targetIso: string): string | null {
  const diff = new Date(targetIso).getTime() - Date.now()
  if (diff <= 0) return null
  const minutes = Math.floor(diff / 60_000)
  const days = Math.floor(minutes / (60 * 24))
  if (days >= 14) return null
  if (days >= 1) return `in ${days}d`
  const hours = Math.floor(minutes / 60)
  if (hours >= 1) return `in ${hours}h`
  return `in ${Math.max(1, minutes)}m`
}

/**
 * Badge compteur compact pour les cartes de comebacks à venir (FOMO, §5).
 * Tick à la minute. Ne s'affiche qu'après hydratation et seulement si l'event
 * est dans la fenêtre (< 14 j, futur).
 */
export function CountdownBadge({ targetIso }: { targetIso: string }) {
  const hydrated = useHydrated()
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!hydrated) return null
  const label = formatShort(targetIso)
  if (!label) return null

  return (
    <span className="inline-flex items-center rounded bg-white/15 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white tabular-nums">
      {label}
    </span>
  )
}
