import { describe, it, expect } from 'vitest'
import { debutGateDecision } from './ingest'
import { passesConfidenceGate } from '@/lib/notifications/comebacks'

// GATE DE SORTIE Phase 3 (audit §12) — testé DANS LES DEUX SENS :
// « un candidat fiable passe de la détection à la publication de ses premiers
// MVs sans intervention, tandis qu'un cas ambigu ne peut ni être publié ni
// déclencher de notification. »

const yt = (subs: number) => ({ channelId: 'UC123', subs })

describe('debutGateDecision (le score/quarantaine — pur)', () => {
  it('SENS FIABLE : date concrète + chaîne vérifiée 50k subs → auto-create monitored', () => {
    const d = debutGateDecision({ debutDate: '2026-08-01', ytVerified: yt(50_000) }, 0)
    expect(d).toEqual({ autoCreate: true, confidence: 'monitored' })
  })

  it('fiable via Deezer seul (pas de chaîne) → auto-create mais QUARANTAINE candidate', () => {
    const d = debutGateDecision({ debutDate: '2026-08-01', ytVerified: null }, 12_000)
    expect(d).toEqual({ autoCreate: true, confidence: 'candidate' })
  })

  it('SENS AMBIGU : pas de date concrète → jamais auto-créé, quel que soit le signal', () => {
    expect(debutGateDecision({ debutDate: null, ytVerified: yt(1_000_000) }, 999_999)).toEqual({
      autoCreate: false,
      confidence: 'monitored',
    })
  })

  it('SENS AMBIGU : audience sous les seuils (YT 9 999, Deezer 4 999) → pending', () => {
    expect(debutGateDecision({ debutDate: '2026-08-01', ytVerified: yt(9_999) }, 4_999)).toEqual({
      autoCreate: false,
      confidence: 'monitored',
    })
    expect(debutGateDecision({ debutDate: '2026-08-01', ytVerified: null }, 0).autoCreate).toBe(
      false,
    )
  })
})

describe('gate de bout en bout : la quarantaine tient (composition avec les builders)', () => {
  it('un groupe candidate ne peut RIEN notifier, même un event confirmed', () => {
    // Le chemin Deezer-seul crée en candidate → ses events sont bloqués par le
    // gate partagé des 2 builders (comebacks + digest), tous statuts confondus.
    const { confidence } = debutGateDecision({ debutDate: '2026-08-01', ytVerified: null }, 12_000)
    expect(confidence).toBe('candidate')
    for (const status of ['confirmed', 'tentative']) {
      expect(passesConfidenceGate({ confidence, status, sourceType: 'kpopofficial' })).toBe(false)
    }
  })

  it('le chemin fiable (monitored) notifie ses MVs youtube_api — zéro intervention', () => {
    const { confidence } = debutGateDecision({ debutDate: '2026-08-01', ytVerified: yt(50_000) }, 0)
    expect(confidence).toBe('monitored')
    // Le MV backfillé depuis la chaîne vérifiée est notifiable immédiatement.
    expect(
      passesConfidenceGate({ confidence, status: 'confirmed', sourceType: 'youtube_api' }),
    ).toBe(true)
    expect(
      passesConfidenceGate({ confidence, status: 'tentative', sourceType: 'youtube_api' }),
    ).toBe(true)
    // Mais une rumeur wikipedia tentative sur ce même groupe reste muette.
    expect(passesConfidenceGate({ confidence, status: 'tentative', sourceType: 'wikipedia' })).toBe(
      false,
    )
  })
})
