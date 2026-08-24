'use client'

// Client depuis R5 : le tri Top/New se fait en mémoire (tri pur) au lieu
// d'une navigation ?sort= qui re-rendait la page entière.
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { CommentCompose } from './comment-compose'
import { CommentThread } from './comment-thread'
import { SortToggle } from './sort-toggle'
import { countVisible, sortThreads, type CommentNode, type SortMode } from '@/lib/comments/tree'

interface Props {
  // Cible : event (MV) OU épisode de music show (Lot N 2026-07-17).
  eventId?: string
  episodeId?: string
  // Revalidation : slug MV OU chemin /show/... complet.
  slug?: string
  path?: string
  isAuthed: boolean
  viewerId: string | null
  threads: CommentNode[]
  initialSort: SortMode
  // Note posée par chaque auteur sur CET event → badge amber (§7.7.4).
  ratingsByUser?: Record<string, number>
}

export function CommentSection({
  eventId = '',
  episodeId = '',
  slug = '',
  path = '',
  isAuthed,
  viewerId,
  threads,
  initialSort,
  ratingsByUser = {},
}: Props) {
  const [sort, setSort] = useState<SortMode>(initialSort)
  // Le serveur livre les fils déjà triés selon initialSort → premier rendu
  // identique (pas de mismatch d'hydratation) ; on ne re-trie qu'au toggle.
  const tries = useMemo(
    () => (sort === initialSort ? threads : sortThreads(threads, sort)),
    [threads, sort, initialSort],
  )
  const count = countVisible(tries)

  return (
    <section id="comments" aria-labelledby="comments-heading" className="scroll-mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        {/* Le compteur n'apparaît qu'à partir du premier commentaire :
            « Discussion — 0 » juste au-dessus de « No comments yet » disait
            deux fois la même absence, sur 3 173 pages MV et 64 épisodes. */}
        <h2 id="comments-heading" className="label-data">
          Discussion{count > 0 ? ` — ${count}` : ''}
        </h2>
        {/* Trier deux commentaires n'a pas de sens : le contrôle n'apparaît
            qu'à partir du moment où il change quelque chose. */}
        {tries.length > 2 && <SortToggle sort={sort} onChange={setSort} />}
      </div>

      {/* Le composer passe EN TÊTE : il était en pied, donc sous la liste
          entière — sur une page qui invite à réagir, l'invitation ne se lit
          pas après avoir fait défiler la discussion. */}
      {isAuthed ? (
        <CommentCompose
          eventId={eventId}
          episodeId={episodeId}
          slug={slug}
          path={path}
          placeholder="Share what you think about this release…"
        />
      ) : (
        <p className="text-muted-foreground bg-card/40 rounded-lg border p-3 text-sm">
          <Link href="/login" className="text-primary underline underline-offset-2">
            Sign in
          </Link>{' '}
          to join the discussion.
        </p>
      )}

      {tries.length === 0 ? (
        <EmptyState
          title="No comments yet"
          description="Be the first to share what you think about this release."
        />
      ) : (
        <div className="space-y-2.5">
          {tries.map((node) => (
            <CommentThread
              key={node.id}
              node={node}
              eventId={eventId}
              episodeId={episodeId}
              slug={slug}
              path={path}
              viewerId={viewerId}
              isAuthed={isAuthed}
              ratingsByUser={ratingsByUser}
            />
          ))}
        </div>
      )}
    </section>
  )
}
