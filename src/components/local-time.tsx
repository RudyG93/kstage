'use client'

import { useHydrated } from '@/hooks/use-hydrated'

// Affiche l'heure locale du visiteur, calculée après hydratation (le serveur
// ne connaît pas le fuseau du navigateur → évite tout mismatch).
export function LocalTime({ iso }: { iso: string }) {
  const hydrated = useHydrated()
  if (!hydrated) return null

  // `timeZoneName: 'short'` ajoute l'abréviation du fuseau local du visiteur
  // (ex « 3:30 PM EDT », ou « GMT+2 » selon le runtime ICU). Plus de « your time ».
  const label = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso))

  return <span>{label}</span>
}
