import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { displayEventTitle } from '@/lib/events/title'
import { formatKst } from '@/lib/events/date'

export const alt = 'Group profile on KStage'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// OG image par groupe — version marque (nom en gros + prochain drop). La
// version photo+Archivo (fonts custom fetchées par génération, images
// distantes en ArrayBuffer) est une itération backlog si les partages
// décollent. Client anon nu : pas de cookies dans ce contexte.
export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: group } = await supabase
    .from('groups')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle()

  let nextLine = 'Comebacks, MVs & schedule'
  if (group) {
    const { data: next } = await supabase
      .from('events')
      .select('title, start_at, type')
      .eq('group_id', group.id)
      .in('type', ['mv', 'release'])
      .gte('start_at', new Date().toISOString())
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (next) {
      const when = formatKst(next.start_at, { month: 'short', day: 'numeric' })
      nextLine = `Next: ${displayEventTitle(next.title, group.name, null, next.type)} — ${when} KST`
    }
  }

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
          fontSize: group && group.name.length > 14 ? 84 : 120,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: '#f4f3fa',
          textAlign: 'center',
        }}
      >
        {group?.name ?? 'KStage'}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 24,
          fontSize: 36,
          color: '#3fe0b8',
          textAlign: 'center',
        }}
      >
        {nextLine}
      </div>
      <div style={{ display: 'flex', marginTop: 48, fontSize: 30, color: '#cbc9d8' }}>
        KStage — your k-pop calendar
      </div>
    </div>,
    size,
  )
}
