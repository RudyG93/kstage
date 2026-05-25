'use client'

import { useHydrated } from '@/hooks/use-hydrated'

// Affiche l'heure locale du visiteur, calculée après hydratation (le serveur
// ne connaît pas le fuseau du navigateur → évite tout mismatch).
export function LocalTime({ iso }: { iso: string }) {
  const hydrated = useHydrated()
  if (!hydrated) return null

  const label = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))

  return <span>{` · ${label} local`}</span>
}
