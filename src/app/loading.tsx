import { Skeleton } from '@/components/ui/skeleton'

// Skeleton global (repli de toutes les routes sans loading.tsx propre) —
// silhouette Data Desk : panneaux hairline 10px + lignes denses, à la place
// des blocs arrondis v1.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 md:px-4 md:py-6">
      <div className="space-y-3">
        <Skeleton className="h-6 w-32 rounded-[7px]" />
        <div className="bg-card overflow-hidden rounded-[10px] border">
          <div className="border-b px-3 py-2">
            <Skeleton className="h-3 w-40 rounded" />
          </div>
          <div className="space-y-3 p-3.5">
            <Skeleton className="h-5 w-3/4 rounded" />
            <Skeleton className="h-16 w-64 rounded-[8px]" />
          </div>
        </div>
        <div className="bg-card overflow-hidden rounded-[10px] border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 border-b px-3 py-2.5 last:border-b-0">
              <Skeleton className="h-4 w-9 shrink-0 rounded" />
              <Skeleton className="h-5 w-14 shrink-0 rounded-[6px]" />
              <Skeleton className="h-4 flex-1 rounded" />
              <Skeleton className="h-3 w-16 shrink-0 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
