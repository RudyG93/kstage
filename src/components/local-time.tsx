'use client'

import { useHydrated } from '@/hooks/use-hydrated'

// Affiche l'heure locale du visiteur, calculée après hydratation (le serveur
// ne connaît pas le fuseau du navigateur → évite tout mismatch).
export function LocalTime({ iso }: { iso: string }) {
  const hydrated = useHydrated()
  if (!hydrated) return null

  const label = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))

  return <span>{`${label} your time`}</span>
}
