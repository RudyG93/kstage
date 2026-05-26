import { ImageResponse } from 'next/og'

export const alt = 'KStage — your k-pop calendar'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0e0e13',
        backgroundImage:
          'linear-gradient(135deg, rgba(139,92,255,0.22), rgba(255,45,135,0.14) 55%, rgba(14,14,19,0) 80%)',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 140,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          backgroundImage: 'linear-gradient(90deg, #8b5cff, #ff2d87)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }}
      >
        KStage
      </div>
      <div style={{ display: 'flex', marginTop: 20, fontSize: 40, color: '#cbc9d8' }}>
        Never miss a comeback again.
      </div>
      <div style={{ display: 'flex', gap: 18, marginTop: 56 }}>
        {['#ff5ca8', '#f5c542', '#ff4d6d', '#cdb4ff'].map((c) => (
          <div key={c} style={{ width: 22, height: 22, borderRadius: 9999, backgroundColor: c }} />
        ))}
      </div>
    </div>,
    size,
  )
}
