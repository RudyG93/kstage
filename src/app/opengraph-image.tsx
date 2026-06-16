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
        backgroundColor: '#0f1118',
        backgroundImage:
          'linear-gradient(135deg, rgba(91,91,240,0.22), rgba(63,224,184,0.14) 55%, rgba(15,17,24,0) 80%)',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 140,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          backgroundImage: 'linear-gradient(90deg, #5b5bf0, #3fe0b8)',
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
        {['#3fe0b8', '#e6ad4c', '#ef6a9b', '#8785ff'].map((c) => (
          <div key={c} style={{ width: 22, height: 22, borderRadius: 9999, backgroundColor: c }} />
        ))}
      </div>
    </div>,
    size,
  )
}
