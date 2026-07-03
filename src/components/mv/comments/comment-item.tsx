'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  deleteComment,
  editComment,
  fetchEditHistory,
  reportComment,
  type CommentState,
} from '@/lib/comments/actions'
import { BODY_MAX } from '@/lib/comments/validation'
import type { CommentEdit } from '@/lib/comments/queries'
import { Avatar } from '@/components/avatar'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
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

const REPLY_LIMIT = 5

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
  const [collapsed, setCollapsed] = useState(false)
  const [showAllReplies, setShowAllReplies] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const isOwn = viewerId === node.user_id
  const isDeleted = Boolean(node.deleted_at)
  const isEdited =
    !isDeleted && new Date(node.updated_at).getTime() - new Date(node.created_at).getTime() > 5_000
  const username = node.author?.username ?? null
  const author = username ?? 'unknown'

  const childCount = node.children.length
  const visibleChildren = showAllReplies ? node.children : node.children.slice(0, REPLY_LIMIT)

  // Repli style Reddit : replié → ligne compacte cliquable pour ré-ouvrir.
  if (collapsed) {
    return (
      <article aria-label={`Comment by ${author}`}>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-xs"
        >
          <span className="tabular">[+]</span>
          <span className="text-foreground font-medium">{author}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{node.score} pts</span>
          {childCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="tabular-nums">
                {childCount} repl{childCount === 1 ? 'y' : 'ies'}
              </span>
            </>
          )}
        </button>
      </article>
    )
  }

  return (
    <article aria-label={`Comment by ${author}`}>
      <div className={childCount > 0 ? 'flex gap-2' : undefined}>
        {/* Rail vertical cliquable : replie CE commentaire et son sous-arbre
            (modèle Reddit). Présent uniquement quand il y a des réponses — la
            racine incluse. */}
        {childCount > 0 && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse thread"
            className="group/rail flex w-3 shrink-0 cursor-pointer justify-center"
          >
            <span
              className="bg-border/70 group-hover/rail:bg-primary w-px rounded-full transition-colors"
              aria-hidden
            />
          </button>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <header className="text-muted-foreground flex items-center gap-2 text-xs">
            {username ? (
              <Link
                href={`/u/${username}`}
                className="text-foreground flex items-center gap-1.5 font-medium hover:underline"
              >
                <Avatar username={username} avatarUrl={node.author?.avatar_url ?? null} size={20} />
                {author}
              </Link>
            ) : (
              <span className="text-foreground flex items-center gap-1.5 font-medium">
                <Avatar username={author} avatarUrl={null} size={20} />
                {author}
              </span>
            )}
            <span aria-hidden>·</span>
            <time dateTime={node.created_at}>{relTime(node.created_at)}</time>
            {isEdited && (
              <>
                <span aria-hidden>·</span>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="italic hover:underline"
                >
                  edited
                </button>
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
              {isOwn ? (
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
              ) : (
                isAuthed && <ReportButton commentId={node.id} />
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

          {childCount > 0 && (
            <div className="space-y-3 pt-1">
              {visibleChildren.map((child) => (
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
              {!showAllReplies && childCount > REPLY_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllReplies(true)}
                  className="text-primary text-xs hover:underline"
                >
                  Show {childCount - REPLY_LIMIT} more repl
                  {childCount - REPLY_LIMIT === 1 ? 'y' : 'ies'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {historyOpen && (
        <HistoryModal
          commentId={node.id}
          currentBody={node.body}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </article>
  )
}

function ReportButton({ commentId }: { commentId: string }) {
  const [pending, startTransition] = useTransition()
  function onReport() {
    const reason = window.prompt('Why are you reporting this comment? (optional)')
    if (reason === null) return // annulé
    startTransition(async () => {
      const res = await reportComment(commentId, reason)
      if ('error' in res) toast.error(res.error)
      else toast.success('Thanks — this comment has been reported.')
    })
  }
  return (
    <button
      type="button"
      onClick={onReport}
      disabled={pending}
      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
    >
      Report
    </button>
  )
}

function HistoryModal({
  commentId,
  currentBody,
  onClose,
}: {
  commentId: string
  currentBody: string
  onClose: () => void
}) {
  const [history, setHistory] = useState<CommentEdit[] | null>(null)

  useEffect(() => {
    let active = true
    fetchEditHistory(commentId).then((h) => {
      if (active) setHistory(h)
    })
    return () => {
      active = false
    }
  }, [commentId])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Edit history</DialogTitle>
        <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
          <div className="border-border/60 rounded-md border p-2">
            <p className="text-muted-foreground mb-1 text-[11px] tracking-wide uppercase">
              Current
            </p>
            <p className="text-sm whitespace-pre-wrap">{currentBody}</p>
          </div>
          {history === null ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No previous versions.</p>
          ) : (
            history.map((h, i) => (
              <div key={i} className="border-border/60 rounded-md border p-2">
                <p className="text-muted-foreground mb-1 text-[11px]">
                  {new Date(h.edited_at).toLocaleString('en-US')}
                </p>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {h.previous_body}
                </p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
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
