import { Skeleton } from '@/components/ui/skeleton'

/** Fallback Suspense des sidebars (Lot F) : un panneau hairline aux dimensions
 * du rail — l'espace est réservé, zéro layout shift au streaming. */
export function RailSkeleton() {
  return (
    <div className="bg-card space-y-3 rounded-lg border p-4">
      <Skeleton className="h-3 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  )
}
