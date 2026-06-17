'use client'

import type { ReactNode } from 'react'
import { useHydrated } from '@/hooks/use-hydrated'

// Affiche l'heure locale du visiteur, calculée après hydratation (le serveur ne
// connaît pas le fuseau du navigateur → évite tout mismatch). `fallback` est
// rendu tant qu'on n'est pas hydraté (ex. l'heure KST), pour ne pas laisser un
// emplacement vide. `withZone` ajoute l'abréviation du fuseau (« GMT+2 »).
export function LocalTime({
  iso,
  fallback = null,
  withZone = true,
}: {
  iso: string
  fallback?: ReactNode
  withZone?: boolean
}) {
  const hydrated = useHydrated()
  if (!hydrated) return <>{fallback}</>

  const label = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    ...(withZone ? { timeZoneName: 'short' } : {}),
  }).format(new Date(iso))

  return <span>{label}</span>
}
