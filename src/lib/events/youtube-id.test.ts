import { describe, it, expect } from 'vitest'
import { extractYouTubeId } from './youtube-id'

describe('extractYouTubeId', () => {
  it('parse une URL watch?v=', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('parse une URL watch avec params additionnels', () => {
    expect(
      extractYouTubeId('https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=30s'),
    ).toBe('dQw4w9WgXcQ')
  })

  it('parse une URL youtu.be courte', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ')
  })

  it('parse une URL embed', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('parse une URL shorts', () => {
    expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('renvoie null pour une URL non-YouTube', () => {
    expect(extractYouTubeId('https://kpopofficial.com/album/ateez/')).toBeNull()
  })

  it('renvoie null pour null/undefined/empty', () => {
    expect(extractYouTubeId(null)).toBeNull()
    expect(extractYouTubeId(undefined)).toBeNull()
    expect(extractYouTubeId('')).toBeNull()
  })

  it('renvoie null si la longueur de l ID est invalide', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=tooshort')).toBeNull()
  })
})
