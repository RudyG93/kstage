'use client'

// Boundary d'erreur runtime, aligné sur not-found.tsx (eyebrow gradient,
// font-heading, buttonVariants) — l'écran d'erreur est une surface user-facing
// comme une autre, il ne doit pas paraître « cassé » lui-même.
import { buttonVariants } from '@/components/ui/button'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-24 text-center">
      <p className="gradient-text label-data-inline text-sm tracking-[0.25em]">Error</p>
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground text-sm">
          This page failed to load. It&apos;s on us — try again.
        </p>
      </div>
      <button type="button" onClick={reset} className={buttonVariants()}>
        Try again
      </button>
    </div>
  )
}
