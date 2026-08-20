import { describe, expect, it } from 'vitest'
import { isConsistentRiffSize, isValidWebpHeader } from './upload'

// Header webp minimal valide : RIFF <size LE> WEBP.
function webpHead(riffSize: number): Buffer {
  const b = Buffer.alloc(16)
  b.write('RIFF', 0, 'latin1')
  b.writeUInt32LE(riffSize, 4)
  b.write('WEBP', 8, 'latin1')
  return b
}

describe('isValidWebpHeader', () => {
  it('accepte une signature RIFF/WEBP', () => {
    expect(isValidWebpHeader(webpHead(100))).toBe(true)
  })
  it('rejette le header corrompu U+FFFD réel (incident 2026-08-20)', () => {
    // Premier cas prod : RIFF puis EF BF BD dans le champ size, fourcc décalé.
    const b = Buffer.from('52494646efbfbd61000057454250', 'hex')
    expect(isValidWebpHeader(b)).toBe(false)
  })
  it('rejette un buffer trop court', () => {
    expect(isValidWebpHeader(Buffer.from('RIFF'))).toBe(false)
  })
})

describe('isConsistentRiffSize', () => {
  it('accepte size+8 = total (±1 padding RIFF)', () => {
    expect(isConsistentRiffSize(webpHead(92), 100)).toBe(true)
    expect(isConsistentRiffSize(webpHead(92), 101)).toBe(true)
  })
  it('rejette le gonflement U+FFFD du corps (cas 9b31e537 : 46 310 déclarés, 83 391 servis)', () => {
    expect(isConsistentRiffSize(webpHead(46_302), 83_391)).toBe(false)
  })
  it('rejette un total inconnu (0)', () => {
    expect(isConsistentRiffSize(webpHead(92), 0)).toBe(false)
  })
})
