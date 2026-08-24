'use client'

import { useActionState, useEffect, useId, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react'
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

interface Cible {
  eventId?: string
  episodeId?: string
  /** Revalidation : slug MV (/mv/[slug]) OU chemin /show/... complet. */
  slug?: string
  path?: string
}

interface Props extends Cible {
  node: CommentNode
  viewerId: string | null
  isAuthed: boolean
  /** Note posée par chaque auteur sur cet event → badge amber (§7.7.4). */
  ratingsByUser?: Record<string, number>
}

/** Date absolue, pour le `title` d'un horodatage relatif. */
const dateComplete = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso))

/**
 * Un FIL : sa tête, puis ses réponses à plat.
 *
 * Le rendu n'est plus récursif. L'imbrication coûtait 28 px par niveau — une
 * colonne de texte de 155 px au plancher sur un écran de 375 px — et chaque
 * niveau cachait ses réponses derrière un clic. `buildCommentThreads` ramène
 * toute la descendance à un seul niveau, et « → @destinataire » porte le
 * contexte que l'indentation portait avant.
 */
export function CommentThread({
  node,
  eventId = '',
  episodeId = '',
  slug = '',
  path = '',
  viewerId,
  isAuthed,
  ratingsByUser = {},
}: Props) {
  const [replie, setReplie] = useState(false)
  // À QUI on répond, pas seulement « on répond ». Dans un fil à plat, c'est
  // cette cible qui produit le « → @destinataire » de la réponse : sans elle,
  // répondre à une réponse perdait le contexte que l'imbrication portait.
  const [repondreA, setRepondreA] = useState<CommentNode | null>(null)
  const nbReponses = node.replies.filter((r) => !r.deleted_at).length
  const cible: Cible = { eventId, episodeId, slug, path }

  return (
    <article
      className="border-border/70 bg-card/40 rounded-lg border"
      aria-label={`Thread started by ${node.author?.username ?? 'unknown'}`}
    >
      <div className="p-3">
        <Commentaire
          node={node}
          slug={slug}
          path={path}
          viewerId={viewerId}
          isAuthed={isAuthed}
          ratingsByUser={ratingsByUser}
          onRepondre={setRepondreA}
          tete
          nbReponses={nbReponses}
          replie={replie}
          onBasculerRepli={() => setReplie((v) => !v)}
        />
      </div>

      {!replie && (nbReponses > 0 || repondreA) && (
        <div className="border-border/70 space-y-3 border-t px-3 py-3 pl-9">
          {node.replies.map((r) => (
            <Commentaire
              key={r.id}
              node={r}
              slug={slug}
              path={path}
              viewerId={viewerId}
              isAuthed={isAuthed}
              ratingsByUser={ratingsByUser}
              onRepondre={setRepondreA}
            />
          ))}

          {repondreA && (
            <CommentCompose
              {...cible}
              // Le parent RÉEL est enregistré en base : le rendu est plat, la
              // donnée reste un arbre. Rebasculer vers un rendu imbriqué ne
              // demanderait aucune migration.
              parentId={repondreA.id}
              focusOnMount
              onCancel={() => setRepondreA(null)}
              placeholder={`Reply to ${repondreA.author?.username ?? 'this comment'}…`}
            />
          )}
        </div>
      )}
    </article>
  )
}

/** Une ligne de commentaire — tête de fil ou réponse. */
function Commentaire({
  node,
  slug = '',
  path = '',
  viewerId,
  isAuthed,
  ratingsByUser = {},
  onRepondre,
  tete = false,
  nbReponses = 0,
  replie = false,
  onBasculerRepli,
}: {
  node: CommentNode
  slug?: string
  path?: string
  viewerId: string | null
  isAuthed: boolean
  ratingsByUser?: Record<string, number>
  onRepondre: (cible: CommentNode) => void
  tete?: boolean
  nbReponses?: number
  replie?: boolean
  onBasculerRepli?: () => void
}) {
  const [editer, setEditer] = useState(false)
  const [historique, setHistorique] = useState(false)
  const noteAuteur = ratingsByUser[node.user_id]
  const estSien = viewerId === node.user_id
  const retire = Boolean(node.deleted_at)
  const edite =
    !retire && new Date(node.updated_at).getTime() - new Date(node.created_at).getTime() > 5_000
  const username = node.author?.username ?? null
  const auteur = username ?? 'unknown'
  const corpsId = `comment-body-${node.id}`

  // Un commentaire retiré ne garde qu'une ligne : il n'existe plus que pour
  // porter ses réponses. Avant, il occupait un bloc complet avec avatar et
  // pseudo — et se retrouvait en tête des deux seules pages commentées.
  if (retire) {
    return (
      <div id={`comment-${node.id}`} className="text-faint scroll-mt-20 text-xs italic">
        Comment removed
      </div>
    )
  }

  return (
    <div id={`comment-${node.id}`} className="scroll-mt-20">
      <div className="flex items-start gap-2.5">
        {username ? (
          <Link href={`/u/${username}`} aria-label={`Profile of ${auteur}`} className="shrink-0">
            <Avatar
              username={username}
              avatarUrl={node.author?.avatar_url ?? null}
              size={tete ? 28 : 22}
            />
          </Link>
        ) : (
          <span className="shrink-0">
            <Avatar username={auteur} avatarUrl={null} size={tete ? 28 : 22} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <header className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {username ? (
              <Link
                href={`/u/${username}`}
                className="text-foreground font-semibold hover:underline"
              >
                {auteur}
              </Link>
            ) : (
              <span className="text-foreground font-semibold">{auteur}</span>
            )}

            {/* Le destinataire remplace l'indentation : c'est lui qui dit à
                QUI on répond quand tout le fil est au même niveau. */}
            {node.replyTo && (
              <a
                href={`#comment-${node.replyTo.id}`}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
              >
                <CornerDownRight className="size-3" aria-hidden />
                <span className="sr-only">In reply to </span>@{node.replyTo.username ?? 'unknown'}
              </a>
            )}

            {noteAuteur !== undefined && (
              <span
                className="tabular bg-amber/15 text-amber rounded-[4px] px-1 py-0.5 text-[10px] font-bold"
                title={`Rated this drop ${noteAuteur}/10`}
              >
                {noteAuteur}
              </span>
            )}

            <a
              href={`#comment-${node.id}`}
              className="hover:text-foreground hover:underline"
              title={dateComplete(node.created_at)}
            >
              <time dateTime={node.created_at}>{relativeTime(node.created_at)}</time>
            </a>

            {edite && (
              <button
                type="button"
                onClick={() => setHistorique(true)}
                className="hover:text-foreground italic hover:underline"
              >
                edited
              </button>
            )}

            {/* Le repli vit dans l'en-tête, à la même place dans les deux
                états : React conserve le bouton, donc le focus ne saute plus
                au <body> à chaque bascule. */}
            {tete && nbReponses > 0 && onBasculerRepli && (
              <button
                type="button"
                onClick={onBasculerRepli}
                aria-expanded={!replie}
                aria-controls={corpsId}
                className="hover:text-foreground ml-auto inline-flex min-h-6 items-center gap-1"
              >
                {replie ? (
                  <ChevronRight className="size-3.5" aria-hidden />
                ) : (
                  <ChevronDown className="size-3.5" aria-hidden />
                )}
                {nbReponses} {nbReponses === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </header>

          {editer ? (
            <div className="mt-1.5">
              <FormulaireEdition
                node={node}
                slug={slug}
                path={path}
                onDone={() => setEditer(false)}
              />
            </div>
          ) : (
            // `break-words` : sans lui une URL collée sortait de la colonne et
            // donnait une barre de défilement horizontale à toute la page.
            <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap">
              {node.body}
            </p>
          )}

          {!editer && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <VoteButtons
                commentId={node.id}
                slug={slug}
                path={path}
                initialScore={node.score}
                initialUserVote={node.userVote}
                isAuthed={isAuthed}
                isOwn={estSien}
              />
              {isAuthed && (
                <button
                  type="button"
                  onClick={() => onRepondre(node)}
                  className="text-muted-foreground hover:text-foreground min-h-6"
                >
                  Reply
                </button>
              )}
              {estSien ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditer(true)}
                    className="text-muted-foreground hover:text-foreground min-h-6"
                  >
                    Edit
                  </button>
                  <BoutonSupprimer commentId={node.id} slug={slug} path={path} />
                </>
              ) : (
                isAuthed && <BoutonSignaler commentId={node.id} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ancre du contenu repliable, pour l'aria-controls de l'en-tête. */}
      <span id={corpsId} hidden />

      {historique && (
        <ModaleHistorique
          commentId={node.id}
          currentBody={node.body}
          onClose={() => setHistorique(false)}
        />
      )}
    </div>
  )
}

function BoutonSignaler({ commentId }: { commentId: string }) {
  const [ouvert, setOuvert] = useState(false)
  const [motif, setMotif] = useState('')
  const [pending, startTransition] = useTransition()

  // Dialog stylé plutôt que window.prompt : plusieurs navigateurs mobiles et
  // webviews in-app (Instagram/TikTok) ignorent prompt() sans erreur — le
  // clic « Report » ne produisait alors rien du tout.
  function envoyer() {
    startTransition(async () => {
      const res = await reportComment(commentId, motif)
      if ('error' in res) toast.error(res.error)
      else {
        toast.success('Thanks — this comment has been reported.')
        setOuvert(false)
        setMotif('')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="text-muted-foreground hover:text-destructive min-h-6"
      >
        Report
      </button>
      {ouvert && (
        <Dialog open onOpenChange={(o) => !o && setOuvert(false)}>
          <DialogContent>
            <DialogTitle>Report this comment</DialogTitle>
            <label htmlFor={`report-reason-${commentId}`} className="sr-only">
              Reason (optional)
            </label>
            <textarea
              id={`report-reason-${commentId}`}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
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
                onClick={() => setOuvert(false)}
                aria-disabled={pending}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={envoyer} aria-disabled={pending}>
                {pending ? 'Reporting…' : 'Report'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

function ModaleHistorique({
  commentId,
  currentBody,
  onClose,
}: {
  commentId: string
  currentBody: string
  onClose: () => void
}) {
  const [historique, setHistorique] = useState<CommentEdit[] | null>(null)

  useEffect(() => {
    let actif = true
    fetchEditHistory(commentId).then((h) => {
      if (actif) setHistorique(h)
    })
    return () => {
      actif = false
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
            <p className="text-sm break-words whitespace-pre-wrap">{currentBody}</p>
          </div>
          <p aria-live="polite" className="sr-only">
            {historique === null ? 'Loading edit history' : 'Edit history loaded'}
          </p>
          {historique === null ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : historique.length === 0 ? (
            <p className="text-muted-foreground text-sm">No previous versions.</p>
          ) : (
            historique.map((h, i) => (
              <div key={i} className="border-border/60 rounded-md border p-2">
                <p className="text-muted-foreground mb-1 text-[11px]">
                  {new Date(h.edited_at).toLocaleString('en-US')}
                </p>
                <p className="text-muted-foreground text-sm break-words whitespace-pre-wrap">
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

function FormulaireEdition({
  node,
  slug,
  path,
  onDone,
}: {
  node: CommentNode
  slug: string
  path: string
  onDone: () => void
}) {
  const [state, formAction, pending] = useActionState<CommentState, FormData>(editComment, null)
  const [chars, setChars] = useState(node.body.length)
  const tropLong = chars > BODY_MAX
  const dernierTraite = useRef<CommentState>(null)
  const champId = useId()

  useEffect(() => {
    if (state && state !== dernierTraite.current && 'ok' in state && state.ok) {
      dernierTraite.current = state
      onDone()
    }
  }, [state, onDone])

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="commentId" value={node.id} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="path" value={path} />
      {/* Le champ n'avait AUCUN nom accessible : ni label, ni aria-label, ni
          placeholder — un lecteur d'écran annonçait « zone d'édition » nue. */}
      <label htmlFor={champId} className="sr-only">
        Edit your comment
      </label>
      <textarea
        id={champId}
        name="body"
        required
        rows={3}
        defaultValue={node.body}
        maxLength={BODY_MAX + 100}
        onChange={(e) => setChars(e.target.value.length)}
        className={cn(
          'border-border bg-background focus-visible:ring-primary/50 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2',
          tropLong && 'border-destructive',
        )}
      />
      <div className="flex items-center justify-between gap-3 text-xs">
        {/* Le compteur n'est annoncé QU'À l'approche de la limite : en
            aria-live permanent, il criait un nombre à chaque frappe. */}
        <span
          className={cn('text-muted-foreground tabular-nums', tropLong && 'text-destructive')}
          aria-hidden={!tropLong}
          aria-live={tropLong ? 'polite' : 'off'}
        >
          {chars}/{BODY_MAX}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDone}
            className="text-muted-foreground hover:text-foreground min-h-8 rounded-md px-2 py-1"
          >
            Cancel
          </button>
          {/* `aria-disabled` et non `disabled` : un bouton désactivé pendant
              la soumission sort de l'ordre de tabulation, et le focus retombe
              au <body>. */}
          <button
            type="submit"
            aria-disabled={pending || chars === 0 || tropLong}
            onClick={(e) => {
              if (pending || chars === 0 || tropLong) e.preventDefault()
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/50 min-h-8 rounded-md px-3 py-1 font-medium outline-none focus-visible:ring-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {pending ? 'Saving your comment' : state && 'ok' in state ? 'Comment updated' : ''}
      </p>
      {state && 'error' in state && (
        <p className="text-destructive text-xs" role="alert">
          {state.error}
        </p>
      )}
    </form>
  )
}

function BoutonSupprimer({
  commentId,
  slug,
  path,
}: {
  commentId: string
  slug: string
  path: string
}) {
  const [state, formAction, pending] = useActionState<CommentState, FormData>(deleteComment, null)
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="commentId" value={commentId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="path" value={path} />
      <button
        type="submit"
        aria-disabled={pending}
        className="text-muted-foreground hover:text-destructive min-h-6 aria-disabled:opacity-50"
        onClick={(e) => {
          if (pending || !window.confirm('Delete this comment?')) e.preventDefault()
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
