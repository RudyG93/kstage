import { describe, expect, it } from 'vitest'
import { buildCommentTree, sortTree, countVisible, type FlatComment } from './tree'

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

describe('buildCommentTree', () => {
  it('liste vide → racine vide', () => {
    expect(buildCommentTree([])).toEqual([])
  })

  it('un seul commentaire root', () => {
    const tree = buildCommentTree([c({ id: 'a' })])
    expect(tree.length).toBe(1)
    expect(tree[0].id).toBe('a')
    expect(tree[0].children).toEqual([])
  })

  it('deux roots indépendants', () => {
    const tree = buildCommentTree([c({ id: 'a' }), c({ id: 'b' })])
    expect(tree.map((t) => t.id).sort()).toEqual(['a', 'b'])
  })

  it('parent + child', () => {
    const tree = buildCommentTree([c({ id: 'a' }), c({ id: 'b', parent_id: 'a' })])
    expect(tree.length).toBe(1)
    expect(tree[0].id).toBe('a')
    expect(tree[0].children.length).toBe(1)
    expect(tree[0].children[0].id).toBe('b')
  })

  it('multi-level nesting (3 niveaux)', () => {
    const tree = buildCommentTree([
      c({ id: 'a' }),
      c({ id: 'b', parent_id: 'a' }),
      c({ id: 'c', parent_id: 'b' }),
    ])
    expect(tree[0].children[0].children[0].id).toBe('c')
  })

  it('orphan promu en root quand parent absent de la liste', () => {
    // 'b' référence un parent inexistant → doit être en root.
    const tree = buildCommentTree([c({ id: 'b', parent_id: 'ghost' })])
    expect(tree.length).toBe(1)
    expect(tree[0].id).toBe('b')
  })
})

describe('sortTree', () => {
  it("sort 'top' = score DESC", () => {
    const flat = [
      c({ id: 'low', score: 1 }),
      c({ id: 'high', score: 10 }),
      c({ id: 'mid', score: 5 }),
    ]
    const sorted = sortTree(buildCommentTree(flat), 'top')
    expect(sorted.map((n) => n.id)).toEqual(['high', 'mid', 'low'])
  })

  it("sort 'top' tiebreaker created_at ASC", () => {
    const flat = [
      c({ id: 'younger', score: 5, created_at: '2026-05-29T10:00:00.000Z' }),
      c({ id: 'older', score: 5, created_at: '2026-05-29T08:00:00.000Z' }),
    ]
    const sorted = sortTree(buildCommentTree(flat), 'top')
    expect(sorted.map((n) => n.id)).toEqual(['older', 'younger'])
  })

  it("sort 'new' = created_at DESC", () => {
    const flat = [
      c({ id: 'old', created_at: '2026-05-29T08:00:00.000Z' }),
      c({ id: 'fresh', created_at: '2026-05-29T12:00:00.000Z' }),
      c({ id: 'mid', created_at: '2026-05-29T10:00:00.000Z' }),
    ]
    const sorted = sortTree(buildCommentTree(flat), 'new')
    expect(sorted.map((n) => n.id)).toEqual(['fresh', 'mid', 'old'])
  })

  it('tri appliqué aussi aux children', () => {
    const flat = [
      c({ id: 'root' }),
      c({ id: 'reply-low', parent_id: 'root', score: 1 }),
      c({ id: 'reply-high', parent_id: 'root', score: 10 }),
    ]
    const sorted = sortTree(buildCommentTree(flat), 'top')
    expect(sorted[0].children.map((n) => n.id)).toEqual(['reply-high', 'reply-low'])
  })
})

describe('countVisible', () => {
  it('compte tout sauf soft-deleted', () => {
    const flat = [
      c({ id: 'a' }),
      c({ id: 'b', parent_id: 'a' }),
      c({ id: 'c', parent_id: 'a', deleted_at: '2026-05-29T00:00:00.000Z' }),
    ]
    expect(countVisible(buildCommentTree(flat))).toBe(2)
  })
})
