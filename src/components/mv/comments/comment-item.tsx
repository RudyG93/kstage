'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { deleteComment, editComment, type CommentState } from '@/lib/comments/actions'
import { BODY_MAX } from '@/lib/comments/validation'
import { cn } from '@/lib/utils'
import { CommentCompose } from './comment-compose'
import { VoteButtons } from './vote-buttons'
import type { CommentNode } from '@/lib/comments/tree'

interface Props {
  node: CommentNode
  eventId: string
  slug: string
  viewerId: string | null
  isAuthed: boolean
  depth?: number
}

const MAX_INDENT = 6

const relTime = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function CommentItem({ node, eventId, slug, viewerId, isAuthed, depth = 0 }: Props) {
  const [showReply, setShowReply] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const isOwn = viewerId === node.user_id
  const isDeleted = Boolean(node.deleted_at)
  const isEdited =
    !isDeleted && new Date(node.updated_at).getTime() - new Date(node.created_at).getTime() > 5_000
  const author = node.author?.username ?? 'unknown'

  const indent = Math.min(depth, MAX_INDENT)
  return (
    <article
      className={cn('space-y-1.5', indent > 0 && 'border-border/50 border-l pl-3')}
      aria-label={`Comment by ${author}`}
    >
      <header className="text-muted-foreground flex items-center gap-2 text-xs">
        <span className="text-foreground font-medium">{author}</span>
        <span aria-hidden>·</span>
        <time dateTime={node.created_at}>{relTime(node.created_at)}</time>
        {isEdited && (
          <>
            <span aria-hidden>·</span>
            <span className="italic">edited</span>
          </>
        )}
      </header>

      {isDeleted ? (
        <p className="text-muted-foreground text-sm italic">[deleted]</p>
      ) : showEdit ? (
        <EditForm node={node} slug={slug} onDone={() => setShowEdit(false)} />
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{node.body}</p>
      )}

      {!isDeleted && !showEdit && (
        <div className="flex items-center gap-3 text-xs">
          <VoteButtons
            commentId={node.id}
            slug={slug}
            initialScore={node.score}
            initialUserVote={node.userVote}
            isAuthed={isAuthed}
          />
          {isAuthed && (
            <button
              type="button"
              onClick={() => setShowReply((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
            >
              {showReply ? 'Cancel' : 'Reply'}
            </button>
          )}
          {isOwn && (
            <>
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                Edit
              </button>
              <DeleteButton commentId={node.id} slug={slug} />
            </>
          )}
        </div>
      )}

      {showReply && (
        <div className="pt-2">
          <CommentCompose
            eventId={eventId}
            slug={slug}
            parentId={node.id}
            focusOnMount
            onCancel={() => setShowReply(false)}
            placeholder={`Reply to ${author}…`}
          />
        </div>
      )}

      {node.children.length > 0 && (
        <div className="mt-2 space-y-3 pt-1">
          {node.children.map((child) => (
            <CommentItem
              key={child.id}
              node={child}
              eventId={eventId}
              slug={slug}
              viewerId={viewerId}
              isAuthed={isAuthed}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </article>
  )
}

function EditForm({ node, slug, onDone }: { node: CommentNode; slug: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<CommentState, FormData>(editComment, null)
  const [chars, setChars] = useState(node.body.length)
  const tooLong = chars > BODY_MAX
  const lastHandledState = useRef<CommentState>(null)

  useEffect(() => {
    if (state && state !== lastHandledState.current && 'ok' in state && state.ok) {
      lastHandledState.current = state
      onDone()
    }
  }, [state, onDone])

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="commentId" value={node.id} />
      <input type="hidden" name="slug" value={slug} />
      <textarea
        name="body"
        required
        rows={3}
        defaultValue={node.body}
        maxLength={BODY_MAX + 100}
        onChange={(e) => setChars(e.target.value.length)}
        className={cn(
          'border-border bg-background focus-visible:ring-primary/50 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2',
          tooLong && 'border-destructive',
        )}
      />
      <div className="flex items-center justify-between gap-3 text-xs">
        <span
          aria-live="polite"
          aria-atomic="true"
          className={cn('text-muted-foreground tabular-nums', tooLong && 'text-destructive')}
        >
          {chars}/{BODY_MAX}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDone}
            className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || chars === 0 || tooLong}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/50 rounded-md px-3 py-1 font-medium outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {state && 'error' in state && (
        <p className="text-destructive text-xs" role="alert">
          {state.error}
        </p>
      )}
    </form>
  )
}

function DeleteButton({ commentId, slug }: { commentId: string; slug: string }) {
  const [state, formAction, pending] = useActionState<CommentState, FormData>(deleteComment, null)
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="commentId" value={commentId} />
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        disabled={pending}
        className="text-muted-foreground hover:text-destructive disabled:opacity-50"
        onClick={(e) => {
          if (!window.confirm('Delete this comment?')) e.preventDefault()
        }}
      >
        {pending ? 'Deleting…' : 'Delete'}
      </button>
      {state && 'error' in state && (
        <span className="text-destructive ml-2 text-xs" role="alert">
          {state.error}
        </span>
      )}
    </form>
  )
}
