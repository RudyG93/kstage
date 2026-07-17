import { describe, expect, it } from 'vitest'
import {
  BODY_MAX,
  parseCommentInput,
  parseEditInput,
  parseVoteInput,
  parseCommentId,
  normalizeBody,
  containsBlockedContent,
} from './validation'

const UUID = '550e8400-e29b-41d4-a716-446655440000'
const UUID2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

describe('normalizeBody', () => {
  it('limite à 1 ligne vide consécutive', () => {
    expect(normalizeBody('a\n\n\n\n\n\nb')).toBe('a\n\nb')
    expect(normalizeBody('a\n\nb')).toBe('a\n\nb')
  })
  it('convertit CRLF en LF et trim', () => {
    expect(normalizeBody('  a\r\nb  ')).toBe('a\nb')
  })
})

describe('parseCommentInput — mur de texte', () => {
  it('rejette une lettre par ligne (trop de lignes)', () => {
    const wall = Array.from({ length: 60 }, (_, i) => String.fromCharCode(97 + (i % 26))).join('\n')
    const r = parseCommentInput({ eventId: UUID, body: wall })
    expect(r).toHaveProperty('error')
  })
  it('laisse passer un commentaire multi-lignes raisonnable', () => {
    const r = parseCommentInput({ eventId: UUID, body: 'line1\nline2\nline3' })
    expect(r).toHaveProperty('value')
  })
})

describe('parseCommentInput — cible event OU épisode (Lot N 2026-07-17)', () => {
  it('cible épisode seule : valide, eventId null', () => {
    const r = parseCommentInput({ episodeId: UUID2, body: 'great episode' })
    expect(r).toHaveProperty('value')
    if ('value' in r) {
      expect(r.value.episodeId).toBe(UUID2)
      expect(r.value.eventId).toBeNull()
    }
  })

  it('les DEUX cibles fournies : rejet (miroir du check DB)', () => {
    expect(parseCommentInput({ eventId: UUID, episodeId: UUID2, body: 'x' })).toHaveProperty(
      'error',
    )
  })

  it('aucune cible : rejet', () => {
    expect(parseCommentInput({ body: 'x' })).toHaveProperty('error')
  })

  it('episodeId non-uuid : rejet', () => {
    expect(parseCommentInput({ episodeId: 'nope', body: 'x' })).toHaveProperty('error')
  })
})

describe('containsBlockedContent', () => {
  it('détecte le spam de la blocklist', () => {
    expect(containsBlockedContent('cheap viagra here')).toBe(true)
    expect(containsBlockedContent('buy followers now')).toBe(true)
    expect(containsBlockedContent('check http://scam.ru/x')).toBe(true)
  })
  it('laisse passer un commentaire normal', () => {
    expect(containsBlockedContent('Great comeback, love this MV!')).toBe(false)
  })
})

describe('parseCommentInput — blocklist', () => {
  it('rejette un body spam', () => {
    const r = parseCommentInput({ eventId: UUID, body: 'cheap viagra' })
    expect(r).toHaveProperty('error')
  })
})

describe('parseCommentInput', () => {
  it('accepte eventId UUID + body trim', () => {
    const r = parseCommentInput({ eventId: UUID, body: '  hello  ' })
    expect(r).toEqual({ value: { eventId: UUID, episodeId: null, parentId: null, body: 'hello' } })
  })
  it('accepte parentId UUID optionnel', () => {
    const r = parseCommentInput({ eventId: UUID, parentId: UUID2, body: 'reply' })
    expect(r).toEqual({ value: { eventId: UUID, episodeId: null, parentId: UUID2, body: 'reply' } })
  })
  it('parentId vide ou null → null', () => {
    expect(parseCommentInput({ eventId: UUID, parentId: '', body: 'x' })).toEqual({
      value: { eventId: UUID, episodeId: null, parentId: null, body: 'x' },
    })
    expect(parseCommentInput({ eventId: UUID, parentId: null, body: 'x' })).toEqual({
      value: { eventId: UUID, episodeId: null, parentId: null, body: 'x' },
    })
  })
  it('rejette eventId non UUID', () => {
    expect(parseCommentInput({ eventId: 'nope', body: 'x' })).toEqual({
      error: 'Invalid event reference.',
    })
  })
  it('rejette parentId non UUID si fourni', () => {
    expect(parseCommentInput({ eventId: UUID, parentId: 'bad', body: 'x' })).toEqual({
      error: 'Invalid parent reference.',
    })
  })
  it('rejette body vide ou whitespace', () => {
    expect(parseCommentInput({ eventId: UUID, body: '' })).toEqual({
      error: 'Comment cannot be empty.',
    })
    expect(parseCommentInput({ eventId: UUID, body: '   \n  ' })).toEqual({
      error: 'Comment cannot be empty.',
    })
  })
  it('rejette body > BODY_MAX', () => {
    const r = parseCommentInput({ eventId: UUID, body: 'a'.repeat(BODY_MAX + 1) })
    expect(r).toEqual({ error: `Comment is too long (${BODY_MAX} chars max).` })
  })
  it('normalise CRLF en LF', () => {
    const r = parseCommentInput({ eventId: UUID, body: 'line1\r\nline2' })
    expect(r).toEqual({
      value: { eventId: UUID, episodeId: null, parentId: null, body: 'line1\nline2' },
    })
  })
})

describe('parseEditInput', () => {
  it('accepte commentId + body trim', () => {
    expect(parseEditInput({ commentId: UUID, body: 'edited' })).toEqual({
      value: { commentId: UUID, body: 'edited' },
    })
  })
  it('rejette commentId non UUID', () => {
    expect(parseEditInput({ commentId: 'bad', body: 'x' })).toEqual({
      error: 'Invalid comment reference.',
    })
  })
})

describe('parseVoteInput', () => {
  it('accepte +1', () => {
    expect(parseVoteInput({ commentId: UUID, value: '1' })).toEqual({
      value: { commentId: UUID, value: 1 },
    })
  })
  it('accepte -1', () => {
    expect(parseVoteInput({ commentId: UUID, value: '-1' })).toEqual({
      value: { commentId: UUID, value: -1 },
    })
  })
  it('rejette valeur 0, 2, "yes"', () => {
    expect(parseVoteInput({ commentId: UUID, value: '0' })).toEqual({
      error: 'Vote value must be +1 or -1.',
    })
    expect(parseVoteInput({ commentId: UUID, value: '2' })).toEqual({
      error: 'Vote value must be +1 or -1.',
    })
    expect(parseVoteInput({ commentId: UUID, value: 'yes' })).toEqual({
      error: 'Vote value must be +1 or -1.',
    })
  })
})

describe('parseCommentId', () => {
  it('accepte UUID', () => {
    expect(parseCommentId({ commentId: UUID })).toEqual({ value: { commentId: UUID } })
  })
  it('rejette non UUID', () => {
    expect(parseCommentId({ commentId: 'bad' })).toEqual({
      error: 'Invalid comment reference.',
    })
  })
})
