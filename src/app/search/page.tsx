import type { Metadata } from 'next'
import { SearchIcon } from 'lucide-react'

export const metadata: Metadata = { title: 'Search' }

// Stub Data Desk §7.3 — la recherche complète (groupes + MV + events) arrive
// avec l'étape 9 de la refonte ; cette page évite un 404 depuis le FAB nav.
export default function SearchPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-4 md:px-4">
      <h1 className="font-heading text-[17px] font-extrabold tracking-[-0.01em]">Search</h1>
      <div className="bg-secondary text-muted-foreground mt-3 flex h-10 items-center gap-2 rounded-[10px] border px-3 text-sm">
        <SearchIcon className="size-4 shrink-0" />
        <span>Search is coming right up — groups, MVs and events.</span>
      </div>
      <p className="text-faint mt-3 text-xs">
        Search covers groups, artists, MVs and events — one box for everything.
      </p>
    </div>
  )
}
