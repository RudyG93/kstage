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

// Run figé : 2026-05-26 09:00 KST → « today » = 26/05, « tomorrow » = 27/05
// (le 28/05 est un jeudi, le 10/07 un vendredi, le 12/07 un dimanche).
const NOW = '2026-05-26T00:00:00Z'
const daily = (
  subs: DigestSubscription[],
  follows: DigestFollow[],
  events: DigestEvent[],
  disabled?: ReadonlyMap<string, ReadonlySet<string>>,
  timeZones?: ReadonlyMap<string, string>,
) => buildDigest(subs, follows, events, 'daily', disabled, timeZones, NOW)

describe('buildDigest — gate de confiance (Phase 3 Lot 2)', () => {
  const follows: DigestFollow[] = [{ userId: 'u1', groupId: 'g1' }]

  it('candidate : jamais dans le digest (ni titre ni corps)', () => {
    const events: DigestEvent[] = [
      { ...ev('g1', 'Ambiguous drop', '2026-05-26T01:00:00Z', 'Mystery'), confidence: 'candidate' },
      { ...ev('g1', 'Real drop', '2026-05-26T02:00:00Z', 'aespa'), confidence: 'verified' },
    ]
    const [message] = daily([sub('u1')], follows, events)
    expect(message.payload.title).toBe('aespa — Real drop · today')
    expect(message.payload.title).not.toContain('Ambiguous drop')
    expect(message.payload.body).not.toContain('Ambiguous drop')
  })

  it('monitored : tentative non-youtube exclu, confirmed inclus', () => {
    const events: DigestEvent[] = [
      {
        ...ev('g1', 'Rumored', '2026-05-26T01:00:00Z', 'X'),
        confidence: 'monitored',
        status: 'tentative',
        sourceType: 'wikipedia',
      },
      {
        ...ev('g1', 'Confirmed', '2026-05-26T02:00:00Z', 'X'),
        confidence: 'monitored',
        status: 'confirmed',
        sourceType: 'kpopofficial',
      },
    ]
    const [message] = daily([sub('u1')], follows, events)
    expect(message.payload.title).toContain('Confirmed')
    expect(message.payload.title).not.toContain('Rumored')
  })

  it('que du candidate → aucun message du tout', () => {
    const messages = daily([sub('u1')], follows, [
      { ...ev('g1', 'Ghost', '2026-05-26T01:00:00Z'), confidence: 'candidate' },
    ])
    expect(messages).toEqual([])
  })
})

describe('buildDigest', () => {
  it('skips users who follow no groups', () => {
    const messages = daily([sub('u1')], [], [ev('g1', 'Comeback', '2026-05-26T00:30:00Z')])
    expect(messages).toEqual([])
  })

  it('skips users whose followed groups have no events in window', () => {
    const messages = daily(
      [sub('u1')],
      [{ userId: 'u1', groupId: 'g1' }],
      [ev('g2', 'Comeback', '2026-05-26T00:30:00Z')],
    )
    expect(messages).toEqual([])
  })

  it("event-led : l'event le plus proche fait le TITRE avec son jour, body vide à 1 event", () => {
    const messages = daily(
      [sub('u1')],
      [{ userId: 'u1', groupId: 'g1' }],
      [ev('g1', 'New single', '2026-05-26T00:30:00Z', 'aespa')],
    )
    expect(messages).toHaveLength(1)
    expect(messages[0].subscription.userId).toBe('u1')
    expect(messages[0].payload).toEqual({
      title: 'aespa — New single · today',
      tag: 'digest',
      body: '',
      // ?src=push = attribution des ouvertures (audit §10.3).
      url: '/calendar?src=push',
    })
  })

  it('le body étiquette les jours de la suite (« Tomorrow: … »), tri par date', () => {
    const follows: DigestFollow[] = [
      { userId: 'u1', groupId: 'g1' },
      { userId: 'u1', groupId: 'g2' },
    ]
    const events = [
      ev('g2', 'Music show', '2026-05-27T09:00:00Z', 'ILLIT'),
      ev('g1', 'Comeback', '2026-05-26T09:00:00Z', 'aespa'),
    ]
    const [message] = daily([sub('u1')], follows, events)
    expect(message.payload.title).toBe('aespa — Comeback · today')
    expect(message.payload.body).toBe('Tomorrow: ILLIT — Music show')
  })

  it("l'étiquette de jour n'est pas répétée pour deux entrées du même jour ; +N more au-delà de 3", () => {
    const follows = [{ userId: 'u1', groupId: 'g1' }]
    const events = [
      ev('g1', 'E1', '2026-05-26T01:00:00Z'),
      ev('g1', 'E2', '2026-05-26T02:00:00Z'),
      ev('g1', 'E3', '2026-05-26T03:00:00Z'),
      ev('g1', 'E4', '2026-05-26T04:00:00Z'),
      ev('g1', 'E5', '2026-05-27T04:00:00Z'),
    ]
    const [message] = daily([sub('u1')], follows, events)
    expect(message.payload.title).toBe('E1 · today')
    expect(message.payload.body).toBe('Today: E2 · E3 · E4 · +1 more')
  })

  it('au-delà de demain : jour court (« Sat ») au lieu de today/tomorrow', () => {
    const follows = [{ userId: 'u1', groupId: 'g1' }]
    const events = [
      ev('g1', 'Tonight', '2026-05-26T09:00:00Z', 'aespa'),
      ev('g1', 'Weekend drop', '2026-05-30T09:00:00Z', 'aespa'), // samedi 30/05
    ]
    const [message] = daily([sub('u1')], follows, events)
    expect(message.payload.body).toBe('Sat: aespa — Weekend drop')
  })

  it('agrège un music show multi-groupes en une entrée (cas prod 5 groupes)', () => {
    const follows = ['g1', 'g2', 'g3', 'g4', 'g5'].map((groupId) => ({ userId: 'u1', groupId }))
    const names = ['ATEEZ', 'Hearts2Hearts', 'izna', 'MEOVV', 'RIIZE']
    const events = names.map((name, i) => ({
      ...ev(`g${i + 1}`, 'Music Bank', '2026-07-10T08:00:00Z', name),
      type: 'music_show',
    }))
    const [message] = daily([sub('u1')], follows, events)
    expect(message.payload.title).toBe('Music Bank (5 artists) · Fri')
    expect(message.payload.body).toBe('')
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
    const [message] = daily([sub('u1')], follows, events)
    expect(message.payload.title).toBe('Inkigayo (aespa, ILLIT) · Sun')
  })

  it('music show singleton : format historique « groupe — titre » conservé', () => {
    const events = [
      { ...ev('g1', 'Music Bank', '2026-07-10T08:00:00Z', 'ATEEZ'), type: 'music_show' },
    ]
    const [message] = daily([sub('u1')], [{ userId: 'u1', groupId: 'g1' }], events)
    expect(message.payload.title).toBe('ATEEZ — Music Bank · Fri')
  })

  it('weekly edition : titre-compteur conservé, body étiqueté par jour', () => {
    const follows = [{ userId: 'u1', groupId: 'g1' }]
    const events = [
      ev('g1', 'Comeback', '2026-05-26T00:30:00Z', 'aespa'),
      ev('g1', 'Music show', '2026-05-28T09:00:00Z', 'aespa'),
    ]
    const [message] = buildDigest([sub('u1')], follows, events, 'weekly', undefined, undefined, NOW)
    expect(message.payload.title).toBe('Your k-pop week: 2 events')
    expect(message.payload.body).toBe('Today: aespa — Comeback · Thu: aespa — Music show')
  })

  it('weekly edition: singulier à 1 event', () => {
    const [message] = buildDigest(
      [sub('u1')],
      [{ userId: 'u1', groupId: 'g1' }],
      [ev('g1', 'Comeback', '2026-05-26T00:30:00Z')],
      'weekly',
      undefined,
      undefined,
      NOW,
    )
    expect(message.payload.title).toBe('Your k-pop week: 1 event')
  })

  it("fuseau de l'abonné : le même instant est « today » à Paris et « tomorrow » en KST (défaut)", () => {
    // 26/05 16:00Z = 27/05 01:00 KST (demain) mais 26/05 18:00 à Paris (aujourd'hui).
    const events = [ev('g1', 'Drop', '2026-05-26T16:00:00Z', 'aespa')]
    const follows = [
      { userId: 'u-paris', groupId: 'g1' },
      { userId: 'u-kst', groupId: 'g1' },
    ]
    const timeZones = new Map([['u-paris', 'Europe/Paris']])
    const messages = daily([sub('u-paris'), sub('u-kst')], follows, events, undefined, timeZones)
    const byUser = new Map(messages.map((m) => [m.subscription.userId, m.payload]))
    expect(byUser.get('u-paris')?.title).toBe('aespa — Drop · today')
    expect(byUser.get('u-kst')?.title).toBe('aespa — Drop · tomorrow')
  })

  it('prefs : type désactivé exclu du titre et du corps', () => {
    const follows = [{ userId: 'u1', groupId: 'g1' }]
    const events = [
      { ...ev('g1', 'Comeback', '2026-05-26T00:30:00Z', 'aespa'), type: 'mv' },
      { ...ev('g1', 'Music Bank', '2026-05-27T08:00:00Z', 'aespa'), type: 'music_show' },
    ]
    const disabled = new Map([['u1', new Set(['music_show'])]])
    const [message] = daily([sub('u1')], follows, events, disabled)
    expect(message.payload.title).toBe('aespa — Comeback · today')
    expect(message.payload.body).toBe('')
  })

  it('prefs : tous les types du user désactivés → aucun message', () => {
    const events = [{ ...ev('g1', 'Comeback', '2026-05-26T00:30:00Z', 'aespa'), type: 'mv' }]
    const disabled = new Map([['u1', new Set(['mv'])]])
    const messages = daily([sub('u1')], [{ userId: 'u1', groupId: 'g1' }], events, disabled)
    expect(messages).toEqual([])
  })

  it("prefs : n'affectent pas les autres users ; event sans type conservé", () => {
    const follows = [
      { userId: 'u1', groupId: 'g1' },
      { userId: 'u2', groupId: 'g1' },
    ]
    const events = [
      { ...ev('g1', 'Comeback', '2026-05-26T00:30:00Z', 'aespa'), type: 'mv' },
      ev('g1', 'Untyped', '2026-05-27T00:30:00Z', 'aespa'), // sans type (compat)
    ]
    const disabled = new Map([['u1', new Set(['mv'])]])
    const messages = daily([sub('u1'), sub('u2')], follows, events, disabled)
    const byUser = new Map(messages.map((m) => [m.subscription.userId, m.payload]))
    expect(byUser.get('u1')?.title).toBe('aespa — Untyped · tomorrow') // l'untyped reste
    expect(byUser.get('u2')?.title).toBe('aespa — Comeback · today')
    expect(byUser.get('u2')?.body).toBe('Tomorrow: aespa — Untyped')
  })

  it('only notifies the subscriptions of users with matching events', () => {
    const subscriptions = [sub('u1'), sub('u2')]
    const follows = [
      { userId: 'u1', groupId: 'g1' },
      { userId: 'u2', groupId: 'g2' },
    ]
    const events = [ev('g1', 'Comeback', '2026-05-26T00:30:00Z')]
    const messages = daily(subscriptions, follows, events)
    expect(messages.map((m) => m.subscription.userId)).toEqual(['u1'])
  })
})
