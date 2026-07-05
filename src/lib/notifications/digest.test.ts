import { describe, it, expect } from 'vitest'
import { buildDigest, type DigestEvent, type DigestFollow, type DigestSubscription } from './digest'

const sub = (userId: string, endpoint = `ep-${userId}`): DigestSubscription => ({
  userId,
  endpoint,
  p256dh: 'p',
  auth: 'a',
})

const ev = (groupId: string, title: string, startAt: string, groupName?: string): DigestEvent => ({
  groupId,
  title,
  startAt,
  groupName,
})

describe('buildDigest', () => {
  it('skips users who follow no groups', () => {
    const messages = buildDigest([sub('u1')], [], [ev('g1', 'Comeback', '2026-05-26T00:00:00Z')])
    expect(messages).toEqual([])
  })

  it('skips users whose followed groups have no events in window', () => {
    const messages = buildDigest(
      [sub('u1')],
      [{ userId: 'u1', groupId: 'g1' }],
      [ev('g2', 'Comeback', '2026-05-26T00:00:00Z')],
    )
    expect(messages).toEqual([])
  })

  it('builds a message for a followed group with an event', () => {
    const messages = buildDigest(
      [sub('u1')],
      [{ userId: 'u1', groupId: 'g1' }],
      [ev('g1', 'New single', '2026-05-26T00:00:00Z', 'aespa')],
    )
    expect(messages).toHaveLength(1)
    expect(messages[0].subscription.userId).toBe('u1')
    expect(messages[0].payload).toEqual({
      title: '1 upcoming event',
      body: 'aespa — New single',
      url: '/calendar',
    })
  })

  it('aggregates multiple followed groups and sorts by start time', () => {
    const follows: DigestFollow[] = [
      { userId: 'u1', groupId: 'g1' },
      { userId: 'u1', groupId: 'g2' },
    ]
    const events = [
      ev('g2', 'Music show', '2026-05-27T09:00:00Z', 'ILLIT'),
      ev('g1', 'Comeback', '2026-05-26T09:00:00Z', 'aespa'),
    ]
    const [message] = buildDigest([sub('u1')], follows, events)
    expect(message.payload.title).toBe('2 upcoming events')
    expect(message.payload.body).toBe('aespa — Comeback, ILLIT — Music show')
  })

  it('caps the listed events at 3 and counts the rest', () => {
    const follows = [{ userId: 'u1', groupId: 'g1' }]
    const events = [
      ev('g1', 'E1', '2026-05-26T01:00:00Z'),
      ev('g1', 'E2', '2026-05-26T02:00:00Z'),
      ev('g1', 'E3', '2026-05-26T03:00:00Z'),
      ev('g1', 'E4', '2026-05-26T04:00:00Z'),
    ]
    const [message] = buildDigest([sub('u1')], follows, events)
    expect(message.payload.title).toBe('4 upcoming events')
    expect(message.payload.body).toBe('E1, E2, E3, +1 more')
  })

  it('agrège un music show multi-groupes en une entrée (cas prod 5 groupes)', () => {
    const follows = ['g1', 'g2', 'g3', 'g4', 'g5'].map((groupId) => ({ userId: 'u1', groupId }))
    const names = ['ATEEZ', 'Hearts2Hearts', 'izna', 'MEOVV', 'RIIZE']
    const events = names.map((name, i) => ({
      ...ev(`g${i + 1}`, 'Music Bank', '2026-07-10T08:00:00Z', name),
      type: 'music_show',
    }))
    const [message] = buildDigest([sub('u1')], follows, events)
    expect(message.payload.title).toBe('1 upcoming event')
    expect(message.payload.body).toBe('Music Bank (5 artists)')
  })

  it('agrège à 2 groupes : les noms sont listés', () => {
    const follows = [
      { userId: 'u1', groupId: 'g1' },
      { userId: 'u1', groupId: 'g2' },
    ]
    const events = [
      { ...ev('g1', 'Inkigayo', '2026-07-12T06:50:00Z', 'aespa'), type: 'music_show' },
      { ...ev('g2', 'Inkigayo', '2026-07-12T06:50:00Z', 'ILLIT'), type: 'music_show' },
    ]
    const [message] = buildDigest([sub('u1')], follows, events)
    expect(message.payload.body).toBe('Inkigayo (aespa, ILLIT)')
  })

  it('music show singleton : format historique « groupe — titre » conservé', () => {
    const events = [
      { ...ev('g1', 'Music Bank', '2026-07-10T08:00:00Z', 'ATEEZ'), type: 'music_show' },
    ]
    const [message] = buildDigest([sub('u1')], [{ userId: 'u1', groupId: 'g1' }], events)
    expect(message.payload.body).toBe('ATEEZ — Music Bank')
  })

  it('weekly edition: titre « Your k-pop week », body inchangé', () => {
    const follows = [{ userId: 'u1', groupId: 'g1' }]
    const events = [
      ev('g1', 'Comeback', '2026-05-26T00:00:00Z', 'aespa'),
      ev('g1', 'Music show', '2026-05-28T09:00:00Z', 'aespa'),
    ]
    const [message] = buildDigest([sub('u1')], follows, events, 'weekly')
    expect(message.payload.title).toBe('Your k-pop week: 2 events')
    expect(message.payload.body).toBe('aespa — Comeback, aespa — Music show')
  })

  it('weekly edition: singulier à 1 event', () => {
    const [message] = buildDigest(
      [sub('u1')],
      [{ userId: 'u1', groupId: 'g1' }],
      [ev('g1', 'Comeback', '2026-05-26T00:00:00Z')],
      'weekly',
    )
    expect(message.payload.title).toBe('Your k-pop week: 1 event')
  })

  it('édition daily par défaut : titre historique inchangé', () => {
    const [message] = buildDigest(
      [sub('u1')],
      [{ userId: 'u1', groupId: 'g1' }],
      [ev('g1', 'Comeback', '2026-05-26T00:00:00Z')],
    )
    expect(message.payload.title).toBe('1 upcoming event')
  })

  it('only notifies the subscriptions of users with matching events', () => {
    const subscriptions = [sub('u1'), sub('u2')]
    const follows = [
      { userId: 'u1', groupId: 'g1' },
      { userId: 'u2', groupId: 'g2' },
    ]
    const events = [ev('g1', 'Comeback', '2026-05-26T00:00:00Z')]
    const messages = buildDigest(subscriptions, follows, events)
    expect(messages.map((m) => m.subscription.userId)).toEqual(['u1'])
  })
})
