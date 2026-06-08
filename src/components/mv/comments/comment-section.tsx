import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { CommentCompose } from './comment-compose'
import { CommentItem } from './comment-item'
import { SortToggle } from './sort-toggle'
import { countVisible, type CommentNode, type SortMode } from '@/lib/comments/tree'

interface Props {
  eventId: string
  slug: string
  isAuthed: boolean
  viewerId: string | null
  roots: CommentNode[]
  sort: SortMode
}

export function CommentSection({ eventId, slug, isAuthed, viewerId, roots, sort }: Props) {
  const count = countVisible(roots)
  return (
    <section
      id="comments"
      aria-labelledby="comments-heading"
      className="scroll-mt-6 space-y-4 border-t pt-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="comments-heading" className="text-sm font-medium">
          Comments ({count})
        </h2>
        <SortToggle slug={slug} sort={sort} />
      </div>

      {isAuthed ? (
        <CommentCompose eventId={eventId} slug={slug} />
      ) : (
        <p className="text-muted-foreground text-sm">
          <Link href="/login" className="text-primary underline-offset-2 hover:underline">
            Sign in
          </Link>{' '}
          to comment.
        </p>
      )}

      {roots.length === 0 ? (
        <EmptyState
          title="No comments yet"
          description="Be the first to share what you think about this release."
        />
      ) : (
        <div className="space-y-4">
          {roots.map((node) => (
            <CommentItem
              key={node.id}
              node={node}
              eventId={eventId}
              slug={slug}
              viewerId={viewerId}
              isAuthed={isAuthed}
            />
          ))}
        </div>
      )}
    </section>
  )
}
