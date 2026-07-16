import { describe, it, expect } from 'vitest'
import {
  buildComebackNotifications,
  type ComebackEvent,
  type ComebackSubscription,
} from './comebacks'

// now = 2026-06-09T03:00:00Z → KST 2026-06-09T12:00 → jour KST "2026-06-09".
const NOW = new Date('2026-06-09T03:00:00Z')

const sub = (userId: string): ComebackSubscription => ({
  userId,
  endpoint: `ep-${userId}`,
  p256dh: 'p',
  auth: 'a',
})

const ev = (over: Partial<ComebackEvent> = {}): ComebackEvent => ({
  id: 'e1',
  groupId: 'g1',
  groupName: 'aespa',
  title: 'Whiplash',
  type: 'mv',
  startAt: '2026-06-09T05:00:00Z', // KST 14:00 même jour → day_of par défaut
  status: 'confirmed',
  url: '/mv/aespa-whiplash',
  ...over,
})

const follow = (userId: string, groupId: string) => ({ userId, groupId })

describe('buildComebackNotifications', () => {
  it('day_of : event dont le jour KST = aujourd’hui', () => {
    const [m] = buildComebackNotifications(
      [sub('u1')],
      [follow('u1', 'g1')],
      [ev()],
      new Set(),
      NOW,
    )
    expect(m.record.kind).toBe('day_of')
    expect(m.payload).toEqual({
      title: '🔥 Today: aespa — Whiplash',
      tag: 'comeback-e1',
      body: 'Out today — go check it out',
      // ?src=push = attribution des ouvertures (audit §10.3) ; le SW matche
      // les onglets par pathname, le param ne casse pas le focus.
      url: '/mv/aespa-whiplash?src=push',
    })
  })

  it('day_before : event dont le jour KST = demain', () => {
    const [m] = buildComebackNotifications(
      [sub('u1')],
      [follow('u1', 'g1')],
      [ev({ startAt: '2026-06-10T05:00:00Z' })], // KST 2026-06-10
      new Set(),
      NOW,
    )
    expect(m.record.kind).toBe('day_before')
    expect(m.payload.title).toBe('⏳ Tomorrow: aespa — Whiplash')
  })

  it("pas de kind 'announced' : un event futur lointain n'émet RIEN, même tout juste ajouté", () => {
    // Budget notifs (Lot 4) : l'annonce vit dans le digest, le push est
    // réservé aux échéances J-1 / jour J.
    const messages = buildComebackNotifications(
      [sub('u1')],
      [follow('u1', 'g1')],
      [ev({ startAt: '2026-06-15T05:00:00Z' })],
      new Set(),
      NOW,
    )
    expect(messages).toEqual([])
  })

  it('contrat tentative : day_of émis (jour connu), aucun payload ne cite une heure', () => {
    // Audit §7.5 : une date sans heure (tentative, minuit KST technique) ne
    // déclenche jamais d'alerte à heure précise. Les kinds jour existants sont
    // légitimes ; leur copy ne doit contenir AUCUNE heure.
    const [m] = buildComebackNotifications(
      [sub('u1')],
      [follow('u1', 'g1')],
      // minuit KST = 15:00 UTC la veille (jour KST 2026-06-09 = aujourd'hui)
      [ev({ status: 'tentative', startAt: '2026-06-08T15:00:00Z' })],
      new Set(),
      NOW,
    )
    expect(m.record.kind).toBe('day_of')
    expect(m.payload.title).not.toMatch(/\d{1,2}:\d{2}/)
    expect(m.payload.body).not.toMatch(/\d{1,2}:\d{2}/)
  })

  it('idempotence : un trigger déjà envoyé est ignoré', () => {
    const already = new Set(['u1:e1:day_of'])
    const messages = buildComebackNotifications(
      [sub('u1')],
      [follow('u1', 'g1')],
      [ev()],
      already,
      NOW,
    )
    expect(messages).toEqual([])
  })

  it('ciblage : seuls les abonnés qui suivent le groupe sont notifiés', () => {
    const messages = buildComebackNotifications(
      [sub('u1'), sub('u2')],
      [follow('u1', 'g1'), follow('u2', 'g2')],
      [ev({ groupId: 'g1' })],
      new Set(),
      NOW,
    )
    expect(messages.map((m) => m.subscription.userId)).toEqual(['u1'])
  })

  it('abonné sans follow : aucun message', () => {
    const messages = buildComebackNotifications([sub('u1')], [], [ev()], new Set(), NOW)
    expect(messages).toEqual([])
  })

  it('prefs : type mv désactivé → pas de push mv, release passe', () => {
    const disabled = new Map([['u1', new Set(['mv'])]])
    const messages = buildComebackNotifications(
      [sub('u1')],
      [follow('u1', 'g1')],
      [ev({ id: 'e-mv', type: 'mv' }), ev({ id: 'e-rel', type: 'release' })],
      new Set(),
      NOW,
      disabled,
    )
    expect(messages.map((m) => m.record.eventId)).toEqual(['e-rel'])
  })

  it("prefs : la désactivation d'un user n'affecte pas les autres", () => {
    const disabled = new Map([['u1', new Set(['mv'])]])
    const messages = buildComebackNotifications(
      [sub('u1'), sub('u2')],
      [follow('u1', 'g1'), follow('u2', 'g1')],
      [ev()],
      new Set(),
      NOW,
      disabled,
    )
    expect(messages.map((m) => m.subscription.userId)).toEqual(['u2'])
  })

  it('prefs : sans map → comportement historique (tout passe)', () => {
    const withMap = buildComebackNotifications(
      [sub('u1')],
      [follow('u1', 'g1')],
      [ev()],
      new Set(),
      NOW,
      new Map(),
    )
    const without = buildComebackNotifications(
      [sub('u1')],
      [follow('u1', 'g1')],
      [ev()],
      new Set(),
      NOW,
    )
    expect(withMap).toEqual(without)
    expect(without).toHaveLength(1)
  })

  describe('gate de confiance (Phase 3 Lot 2, audit §4.1)', () => {
    it('candidate : JAMAIS notifié, quels que soient status et source', () => {
      for (const over of [
        { status: 'confirmed', sourceType: 'youtube_api' },
        { status: 'confirmed', sourceType: 'kpopofficial' },
        { status: 'tentative', sourceType: null },
      ]) {
        const messages = buildComebackNotifications(
          [sub('u1')],
          [follow('u1', 'g1')],
          [ev({ confidence: 'candidate', ...over })],
          new Set(),
          NOW,
        )
        expect(messages).toEqual([])
      }
    })

    it('monitored : tentative + source non-youtube exclu', () => {
      const messages = buildComebackNotifications(
        [sub('u1')],
        [follow('u1', 'g1')],
        [ev({ confidence: 'monitored', status: 'tentative', sourceType: 'wikipedia' })],
        new Set(),
        NOW,
      )
      expect(messages).toEqual([])
    })

    it('monitored : confirmed inclus ; tentative + youtube_api inclus', () => {
      const confirmed = buildComebackNotifications(
        [sub('u1')],
        [follow('u1', 'g1')],
        [ev({ confidence: 'monitored', status: 'confirmed', sourceType: 'kpopofficial' })],
        new Set(),
        NOW,
      )
      expect(confirmed).toHaveLength(1)
      const youtube = buildComebackNotifications(
        [sub('u1')],
        [follow('u1', 'g1')],
        [ev({ confidence: 'monitored', status: 'tentative', sourceType: 'youtube_api' })],
        new Set(),
        NOW,
      )
      expect(youtube).toHaveLength(1)
    })

    it('verified / champ absent : comportement historique', () => {
      const verified = buildComebackNotifications(
        [sub('u1')],
        [follow('u1', 'g1')],
        [ev({ confidence: 'verified', status: 'tentative' })],
        new Set(),
        NOW,
      )
      expect(verified).toHaveLength(1)
      const absent = buildComebackNotifications(
        [sub('u1')],
        [follow('u1', 'g1')],
        [ev()],
        new Set(),
        NOW,
      )
      expect(absent).toHaveLength(1)
    })
  })

  describe('fuseau par abonné (Lot 3b)', () => {
    it('un même event : day_before à Séoul, day_of à Los Angeles', () => {
      // now = 09/06 14:00 UTC, event = 09/06 16:00 UTC.
      // Séoul (UTC+9) : now = 09/06 23:00, event = 10/06 01:00 → demain → day_before.
      // LA (UTC-7)    : now = 09/06 07:00, event = 09/06 09:00 → même jour → day_of.
      const nowUtc = new Date('2026-06-09T14:00:00Z')
      const event = ev({ startAt: '2026-06-09T16:00:00Z' })
      const timeZones = new Map([
        ['seoul', 'Asia/Seoul'],
        ['la', 'America/Los_Angeles'],
      ])
      const messages = buildComebackNotifications(
        [sub('seoul'), sub('la')],
        [follow('seoul', 'g1'), follow('la', 'g1')],
        [event],
        new Set(),
        nowUtc,
        undefined,
        timeZones,
      )
      const kinds = Object.fromEntries(messages.map((m) => [m.subscription.userId, m.record.kind]))
      expect(kinds).toEqual({ seoul: 'day_before', la: 'day_of' })
    })

    it('sans map de fuseaux → identique au comportement KST historique', () => {
      const withEmpty = buildComebackNotifications(
        [sub('u1')],
        [follow('u1', 'g1')],
        [ev()],
        new Set(),
        NOW,
        undefined,
        new Map(),
      )
      const without = buildComebackNotifications(
        [sub('u1')],
        [follow('u1', 'g1')],
        [ev()],
        new Set(),
        NOW,
      )
      expect(withEmpty).toEqual(without)
      expect(without[0].record.kind).toBe('day_of')
    })

    it('addDaysKey : changement de mois + fuseau négatif (piège du round-trip minuit UTC)', () => {
      // now = 30/06 20:00 UTC → 30/06 13:00 à LA (jour local 06-30).
      // Event 01/07 19:00 UTC → 01/07 12:00 à LA = demain local → day_before.
      // Un addDaysKey qui repasserait par un fuseau négatif raterait le 07-01.
      const nowUtc = new Date('2026-06-30T20:00:00Z')
      const messages = buildComebackNotifications(
        [sub('la')],
        [follow('la', 'g1')],
        [ev({ startAt: '2026-07-01T19:00:00Z' })],
        new Set(),
        nowUtc,
        undefined,
        new Map([['la', 'America/Los_Angeles']]),
      )
      expect(messages).toHaveLength(1)
      expect(messages[0].record.kind).toBe('day_before')
    })
  })
})
