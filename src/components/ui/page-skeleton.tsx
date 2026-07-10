import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton de page Data Desk (panneaux hairline + lignes denses). Utilisé par
 * les loading.tsx des pages LISTES uniquement — jamais au-dessus d'un segment
 * dynamique qui peut notFound() : un boundary de loading force le streaming du
 * shell et fige le statut HTTP à 200 avant le lookup → soft-404 (les slugs
 * inexistants répondaient 200 sur tout le site tant que le loading était à la
 * racine, audit 2026-07-10).
 */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 md:px-4 md:py-6">
      <div className="space-y-3">
        <Skeleton className="h-6 w-32 rounded-[7px]" />
        <div className="bg-card overflow-hidden rounded-lg border">
          <div className="border-b px-3 py-2">
            <Skeleton className="h-3 w-40 rounded" />
          </div>
          <div className="space-y-3 p-3.5">
            <Skeleton className="h-5 w-3/4 rounded" />
            <Skeleton className="h-16 w-64 rounded-md" />
          </div>
        </div>
        <div className="bg-card overflow-hidden rounded-lg border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 border-b px-3 py-2.5 last:border-b-0">
              <Skeleton className="h-4 w-9 shrink-0 rounded" />
              <Skeleton className="h-5 w-14 shrink-0 rounded-sm" />
              <Skeleton className="h-4 flex-1 rounded" />
              <Skeleton className="h-3 w-16 shrink-0 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
