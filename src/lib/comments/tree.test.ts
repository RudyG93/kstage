import { describe, expect, it } from 'vitest'
import {
  buildCommentThreads,
  sortThreads,
  countVisible,
  type CommentNode,
  type FlatComment,
} from './tree'

function c(over: Partial<FlatComment> & { id: string }): FlatComment {
  return {
    id: over.id,
    event_id: over.event_id ?? 'evt',
    user_id: over.user_id ?? 'u1',
    parent_id: over.parent_id ?? null,
    body: over.body ?? 'x',
    created_at: over.created_at ?? '2026-05-29T00:00:00.000Z',
    updated_at: over.updated_at ?? '2026-05-29T00:00:00.000Z',
    deleted_at: over.deleted_at ?? null,
    author: over.author ?? { username: 'alice', avatar_url: null },
    score: over.score ?? 0,
    userVote: over.userVote ?? null,
  }
}

const ids = (ns: readonly CommentNode[]) => ns.map((n) => n.id)

describe('buildCommentThreads', () => {
  it('liste vide → aucun fil', () => {
    expect(buildCommentThreads([])).toEqual([])
  })

  it('un commentaire seul est une tête sans réponse', () => {
    const fils = buildCommentThreads([c({ id: 'a' })])
    expect(fils.length).toBe(1)
    expect(fils[0].id).toBe('a')
    expect(fils[0].replies).toEqual([])
    expect(fils[0].replyTo).toBeNull()
  })

  it('deux têtes indépendantes', () => {
    expect(ids(buildCommentThreads([c({ id: 'a' }), c({ id: 'b' })])).sort()).toEqual(['a', 'b'])
  })

  it('une réponse directe se range sous sa tête, sans destinataire affiché', () => {
    const fils = buildCommentThreads([c({ id: 'a' }), c({ id: 'b', parent_id: 'a' })])
    expect(fils.length).toBe(1)
    expect(ids(fils[0].replies)).toEqual(['b'])
    // Répondre à la tête n'a pas besoin d'être annoncé : c'est le fil.
    expect(fils[0].replies[0].replyTo).toBeNull()
  })

  it('APLATIT : une réponse de réponse remonte au même niveau, avec son destinataire', () => {
    const fils = buildCommentThreads([
      c({ id: 'a', author: { username: 'alice', avatar_url: null } }),
      c({ id: 'b', parent_id: 'a', author: { username: 'bob', avatar_url: null } }),
      c({ id: 'c', parent_id: 'b', author: { username: 'carol', avatar_url: null } }),
    ])
    expect(fils.length).toBe(1)
    expect(ids(fils[0].replies)).toEqual(['b', 'c'])
    expect(fils[0].replies[1].replyTo).toEqual({ id: 'b', username: 'bob' })
  })

  it('une chaîne profonde reste un seul fil à un niveau', () => {
    const flat = [c({ id: 'r' })]
    for (let i = 0; i < 30; i++) {
      flat.push(
        c({
          id: `n${i}`,
          parent_id: i === 0 ? 'r' : `n${i - 1}`,
          created_at: `2026-05-29T00:${String(i).padStart(2, '0')}:00.000Z`,
        }),
      )
    }
    const fils = buildCommentThreads(flat)
    expect(fils.length).toBe(1)
    expect(fils[0].replies.length).toBe(30)
    expect(fils[0].replies.every((r) => r.replies.length === 0)).toBe(true)
  })

  it('les réponses se lisent dans l’ordre où elles ont été écrites', () => {
    const fils = buildCommentThreads([
      c({ id: 'a' }),
      c({ id: 'tard', parent_id: 'a', created_at: '2026-05-29T12:00:00.000Z', score: 99 }),
      c({ id: 'tot', parent_id: 'a', created_at: '2026-05-29T08:00:00.000Z', score: 0 }),
    ])
    // Chronologique, pas par score : un échange trié par score se lit à l'envers.
    expect(ids(fils[0].replies)).toEqual(['tot', 'tard'])
  })

  it('orphelin promu en tête quand son parent est absent de la liste', () => {
    const fils = buildCommentThreads([c({ id: 'b', parent_id: 'ghost' })])
    expect(ids(fils)).toEqual(['b'])
  })

  it('un cycle de parents ne boucle pas', () => {
    // Impossible via l'app, mais une donnée corrompue ne doit pas figer le rendu.
    const fils = buildCommentThreads([
      c({ id: 'x', parent_id: 'y' }),
      c({ id: 'y', parent_id: 'x' }),
    ])
    expect(Array.isArray(fils)).toBe(true)
  })
})

describe('sortThreads', () => {
  it("'top' = score DESC", () => {
    const fils = buildCommentThreads([
      c({ id: 'low', score: 1 }),
      c({ id: 'high', score: 10 }),
      c({ id: 'mid', score: 5 }),
    ])
    expect(ids(sortThreads(fils, 'top'))).toEqual(['high', 'mid', 'low'])
  })

  it("'top' départage par created_at ASC", () => {
    const fils = buildCommentThreads([
      c({ id: 'jeune', score: 5, created_at: '2026-05-29T10:00:00.000Z' }),
      c({ id: 'vieux', score: 5, created_at: '2026-05-29T08:00:00.000Z' }),
    ])
    expect(ids(sortThreads(fils, 'top'))).toEqual(['vieux', 'jeune'])
  })

  it("'new' = created_at DESC", () => {
    const fils = buildCommentThreads([
      c({ id: 'vieux', created_at: '2026-05-29T08:00:00.000Z' }),
      c({ id: 'frais', created_at: '2026-05-29T12:00:00.000Z' }),
      c({ id: 'milieu', created_at: '2026-05-29T10:00:00.000Z' }),
    ])
    expect(ids(sortThreads(fils, 'new'))).toEqual(['frais', 'milieu', 'vieux'])
  })

  it('un fil RETIRÉ tombe en fin de liste, quel que soit son score', () => {
    // Les deux seules pages commentées de la prod s'ouvraient sur « [deleted] » :
    // à score égal, le tri par created_at ASC mettait la tombstone devant.
    const fils = buildCommentThreads([
      c({
        id: 'retire',
        score: 99,
        created_at: '2026-05-29T08:00:00.000Z',
        deleted_at: '2026-05-29T09:00:00.000Z',
      }),
      c({ id: 'vivant', score: 0, created_at: '2026-05-29T10:00:00.000Z' }),
    ])
    expect(ids(sortThreads(fils, 'top'))).toEqual(['vivant', 'retire'])
    expect(ids(sortThreads(fils, 'new'))).toEqual(['vivant', 'retire'])
  })
})

describe('countVisible', () => {
  it('compte les têtes et les réponses, sauf les retirées', () => {
    const fils = buildCommentThreads([
      c({ id: 'a' }),
      c({ id: 'b', parent_id: 'a' }),
      c({ id: 'c', parent_id: 'a', deleted_at: '2026-05-29T00:00:00.000Z' }),
      c({ id: 'd', parent_id: 'b' }),
    ])
    expect(countVisible(fils)).toBe(3)
  })
})
