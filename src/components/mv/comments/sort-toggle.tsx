'use client'

import { cn } from '@/lib/utils'
import type { SortMode } from '@/lib/comments/tree'

// Tri CONTRÔLÉ (R5) : plus de navigation ?sort= — le changement d'URL
// re-rendait toute la page (« ça ralentit », retour Rudy). Le parent
// (CommentSection, client) trie l'arbre en mémoire via sortTree.
export function SortToggle({
  sort,
  onChange,
}: {
  sort: SortMode
  onChange: (s: SortMode) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Sort comments"
      className="bg-secondary inline-flex gap-0.5 rounded-md border p-0.5"
    >
      {(['top', 'new'] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={sort === s}
          onClick={() => onChange(s)}
          className={cn(
            'label-data-inline focus-visible:ring-ring/50 cursor-pointer rounded-sm px-2.5 py-1 text-[9px] outline-none focus-visible:ring-2',
            sort === s
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {s === 'top' ? 'Top' : 'New'}
        </button>
      ))}
    </div>
  )
}
