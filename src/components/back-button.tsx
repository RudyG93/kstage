'use client'

import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Bouton rond flottant (player MV, bannière groupe §7.6-7.7) : bg page/55 + blur.
// `fallbackHref` (round 2026-07-18) : page ouverte dans un NOUVEL onglet →
// l'historique n'a qu'une entrée, router.back() ne faisait rien — on route
// alors vers la destination naturelle (page groupe pour un MV, /calendar pour
// un épisode).
export function BackButton({
  className,
  fallbackHref = '/',
}: {
  className?: string
  fallbackHref?: Route
}) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length <= 1) router.push(fallbackHref)
        else router.back()
      }}
      aria-label="Back"
      className={cn(
        'bg-page/55 text-foreground hover:bg-page/75 focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-full backdrop-blur-[8px] transition-colors outline-none focus-visible:ring-2',
        className,
      )}
    >
      <ArrowLeftIcon className="size-4" />
    </button>
  )
}
