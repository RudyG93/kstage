'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
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
import { relativeTime } from '@/lib/events/date'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
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
  // Note posée par chaque auteur sur cet event → badge amber (§7.7.4).
  ratingsByUser?: Record<string, number>
}

const REPLY_LIMIT = 5
// À l'arrivée, les fils sont REPLIÉS (retour Rudy 2026-07-12 : dérouler tout
// l'arbre fait lourd) : une racine montre sa MEILLEURE réponse (children déjà
// triés top-first par sortTree), le reste derrière « Show N replies » ; les
// niveaux plus profonds n'en montrent aucune.
const REPLY_PREVIEW_ROOT = 1
// Auto-repli des commentaires très négatifs (modèle Reddit) — ré-ouvrables
// d'un clic via la ligne compacte.
const AUTO_COLLAPSE_SCORE = -3
// Au-delà, on cesse d'indenter (plus de rail) : le padding cumulé écraserait
// le mobile. Le fil continue à plat.
const MAX_INDENT_DEPTH = 6

export function CommentItem({
  node,
  eventId,
  slug,
  viewerId,
  isAuthed,
  depth = 0,
  ratingsByUser = {},
}: Props) {
  const authorScore = ratingsByUser[node.user_id]
  const [showReply, setShowReply] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [collapsed, setCollapsed] = useState(node.score <= AUTO_COLLAPSE_SCORE)
  const [showAllReplies, setShowAllReplies] = useState(false)
  const [repliesOpen, setRepliesOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const isOwn = viewerId === node.user_id
  const isDeleted = Boolean(node.deleted_at)
  const isEdited =
    !isDeleted && new Date(node.updated_at).getTime() - new Date(node.created_at).getTime() > 5_000
  const username = node.author?.username ?? null
  const author = username ?? 'unknown'

  const childCount = node.children.length
  const replyPreview = depth === 0 ? REPLY_PREVIEW_ROOT : 0
  const visibleChildren = showAllReplies
    ? node.children
    : node.children.slice(0, repliesOpen ? REPLY_LIMIT : replyPreview)

  // Repli style Reddit : replié → ligne compacte cliquable pour ré-ouvrir.
  if (collapsed) {
    return (
      <article
        id={`comment-${node.id}`}
        className="scroll-mt-20"
        aria-label={`Comment by ${author}`}
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          aria-label={`Expand comment by ${author}`}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs"
        >
          {/* Chevron discret (R7) : seule commande d'expansion quand le trait
              est masqué (comment replié) — plus de « [+] » entre crochets. */}
          <ChevronRight className="text-faint size-3.5 shrink-0" aria-hidden />
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
          {node.score <= AUTO_COLLAPSE_SCORE && (
            <span className="text-faint italic">· low score</span>
          )}
        </button>
      </article>
    )
  }

  // Fil v3 (retour Rudy 2026-07-17) : UN rail continu sur TOUTE la hauteur du
  // bloc réponses — le fil matérialise exactement la zone repliable (la
  // hit-area cliquable est déjà pleine hauteur, le visuel v2 « tronc qui
  // s'arrête au dernier coude » disparaissait carrément quand une racine ne
  // montre qu'une réponse, cas par défaut REPLY_PREVIEW_ROOT=1). Les coudes
  // arrondis relient le rail à chaque réponse. Au-delà de MAX_INDENT_DEPTH :
  // à plat.
  const showThread = depth < MAX_INDENT_DEPTH
  const previewTail = childCount > 0 && !repliesOpen && childCount > replyPreview
  const limitTail = childCount > 0 && repliesOpen && !showAllReplies && childCount > REPLY_LIMIT
  // Coude arrondi reliant le tronc vertical (x=10px, sous l'avatar parent) à
  // l'avatar de chaque réponse. `group-hover/thread` : tout le fil s'éclaire
  // légèrement quand on survole la zone (le halo de fond a été retiré, R7).
  const elbow = (
    <span
      aria-hidden
      className="border-muted-foreground/30 group-hover/thread:border-muted-foreground/55 pointer-events-none absolute top-0 -left-[10px] h-3 w-2.5 rounded-bl-[8px] border-b border-l transition-colors"
    />
  )

  return (
    <article id={`comment-${node.id}`} className="scroll-mt-20" aria-label={`Comment by ${author}`}>
      <div className="min-w-0 space-y-1.5">
        {/* Plus de [−] ici (R7) : le repli passe par le trait vertical cliquable
            du bloc réponses, pour ne pas encombrer chaque en-tête. */}
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
          {authorScore !== undefined && !isDeleted && (
            <span
              className="tabular bg-amber/15 text-amber rounded-[4px] px-1 py-0.5 text-[10px] font-bold"
              title={`Rated this drop ${authorScore}/10`}
            >
              {authorScore}
            </span>
          )}
          <span aria-hidden>·</span>
          {/* Permalink (modèle Reddit) : le timestamp pointe l'ancre du
                commentaire — copiable/partageable, highlight via :target. */}
          <Link
            href={`#comment-${node.id}`}
            className="hover:text-foreground hover:underline"
            title="Link to this comment"
          >
            <time dateTime={node.created_at}>{relativeTime(node.created_at)}</time>
          </Link>
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
          <div className={showThread ? 'group/thread relative pt-1 pl-5' : 'pt-1'}>
            {showThread && (
              <>
                {/* Rail continu pleine hauteur : le visuel du fil = la zone
                    repliable. Aligné sur l'origine des coudes (x = 10px). */}
                <span
                  aria-hidden
                  className="bg-muted-foreground/30 group-hover/thread:bg-muted-foreground/55 pointer-events-none absolute top-0 bottom-0 left-[10px] w-px transition-colors"
                />
                {/* Zone cliquable = le rail (hit area 16px), SANS fond au survol
                    (retour Rudy R7 : « le halo est trop gros »). Le clic replie ce
                    commentaire ; le survol éclaire le fil via group/thread. */}
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  aria-label="Collapse thread"
                  className="focus-visible:ring-ring/50 absolute inset-y-0 left-0 z-10 w-4 cursor-pointer rounded outline-none focus-visible:ring-2"
                />
              </>
            )}
            <div className="space-y-3">
              {visibleChildren.map((child) => (
                <div key={child.id} className="relative">
                  {showThread && elbow}
                  <CommentItem
                    node={child}
                    eventId={eventId}
                    slug={slug}
                    viewerId={viewerId}
                    isAuthed={isAuthed}
                    depth={depth + 1}
                    ratingsByUser={ratingsByUser}
                  />
                </div>
              ))}
              {previewTail && (
                <div className="relative">
                  {showThread && elbow}
                  <button
                    type="button"
                    onClick={() => setRepliesOpen(true)}
                    className="text-primary text-xs hover:underline"
                  >
                    Show {childCount - replyPreview} repl
                    {childCount - replyPreview === 1 ? 'y' : 'ies'}
                  </button>
                </div>
              )}
              {limitTail && (
                <div className="relative">
                  {showThread && elbow}
                  <button
                    type="button"
                    onClick={() => setShowAllReplies(true)}
                    className="text-primary text-xs hover:underline"
                  >
                    Show {childCount - REPLY_LIMIT} more repl
                    {childCount - REPLY_LIMIT === 1 ? 'y' : 'ies'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
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
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  // Dialog stylé plutôt que window.prompt : plusieurs navigateurs mobiles et
  // webviews in-app (Instagram/TikTok) ignorent prompt() sans erreur — le
  // clic « Report » ne produisait alors rien du tout.
  function submit() {
    startTransition(async () => {
      const res = await reportComment(commentId, reason)
      if ('error' in res) toast.error(res.error)
      else {
        toast.success('Thanks — this comment has been reported.')
        setOpen(false)
        setReason('')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-destructive"
      >
        Report
      </button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent>
            <DialogTitle>Report this comment</DialogTitle>
            <label htmlFor={`report-reason-${commentId}`} className="sr-only">
              Reason (optional)
            </label>
            <textarea
              id={`report-reason-${commentId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you reporting this comment? (optional)"
              rows={3}
              maxLength={500}
              className="border-border bg-secondary focus-visible:ring-ring mt-3 w-full resize-none rounded-md border px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={submit} disabled={pending}>
                {pending ? 'Reporting…' : 'Report'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
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
