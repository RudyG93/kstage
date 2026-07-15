import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { displaySongTitle } from '@/lib/events/title'
import { formatKst } from '@/lib/events/date'

export const alt = 'Music video on KStage'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// OG image par MV — version marque (titre + groupe + date de sortie).
// Cf. groups/[slug]/opengraph-image.tsx pour le choix « minimal d'abord ».
export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: event } = await supabase
    .from('events')
    .select('title, start_at, groups!inner(name)')
    .eq('slug', slug)
    .eq('hidden', false)
    .maybeSingle()

  const groupName = event?.groups?.name ?? null
  const title = event ? displaySongTitle(event.title, groupName) : 'KStage'
  const dropped = event
    ? `Dropped ${formatKst(event.start_at, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : ''

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
        padding: 60,
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: title.length > 20 ? 72 : 100,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: '#f4f3fa',
          textAlign: 'center',
        }}
      >
        {title}
      </div>
      {groupName && (
        <div style={{ display: 'flex', marginTop: 20, fontSize: 44, color: '#3fe0b8' }}>
          {groupName}
        </div>
      )}
      {dropped && (
        <div style={{ display: 'flex', marginTop: 28, fontSize: 30, color: '#cbc9d8' }}>
          {dropped}
        </div>
      )}
      <div style={{ display: 'flex', marginTop: 40, fontSize: 26, color: '#8d8a9e' }}>
        KStage — your k-pop calendar
      </div>
    </div>,
    size,
  )
}
