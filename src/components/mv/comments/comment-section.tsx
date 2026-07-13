'use client'

// Client depuis R5 : le tri Top/New se fait en mémoire (sortTree pur) au lieu
// d'une navigation ?sort= qui re-rendait la page entière.
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { CommentCompose } from './comment-compose'
import { CommentItem } from './comment-item'
import { SortToggle } from './sort-toggle'
import { countVisible, sortTree, type CommentNode, type SortMode } from '@/lib/comments/tree'

interface Props {
  eventId: string
  slug: string
  isAuthed: boolean
  viewerId: string | null
  roots: CommentNode[]
  initialSort: SortMode
  // Note posée par chaque auteur sur CET event → badge amber (§7.7.4).
  ratingsByUser?: Record<string, number>
}

export function CommentSection({
  eventId,
  slug,
  isAuthed,
  viewerId,
  roots,
  initialSort,
  ratingsByUser = {},
}: Props) {
  const [sort, setSort] = useState<SortMode>(initialSort)
  // Le serveur livre l'arbre déjà trié selon initialSort → premier rendu
  // identique (pas de mismatch d'hydratation) ; on ne re-trie qu'au toggle.
  const sorted = useMemo(
    () => (sort === initialSort ? roots : sortTree(roots, sort)),
    [roots, sort, initialSort],
  )
  const count = countVisible(sorted)
  return (
    <section id="comments" aria-labelledby="comments-heading" className="scroll-mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="comments-heading" className="label-data">
          Discussion — {count}
        </h2>
        <SortToggle sort={sort} onChange={setSort} />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="No comments yet"
          description="Be the first to share what you think about this release."
        />
      ) : (
        <div className="space-y-4">
          {sorted.map((node) => (
            <CommentItem
              key={node.id}
              node={node}
              eventId={eventId}
              slug={slug}
              viewerId={viewerId}
              isAuthed={isAuthed}
              ratingsByUser={ratingsByUser}
            />
          ))}
        </div>
      )}

      {/* Composer en pied de discussion (§7.7.4). */}
      {isAuthed ? (
        <div className="border-t pt-3">
          <CommentCompose eventId={eventId} slug={slug} placeholder="Join the discussion…" />
        </div>
      ) : (
        <p className="text-muted-foreground border-t pt-3 text-sm">
          <Link href="/login" className="text-primary underline-offset-2 hover:underline">
            Sign in
          </Link>{' '}
          to join the discussion.
        </p>
      )}
    </section>
  )
}
