import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const alt = 'Artist profile on KStage'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * OG des ~1 250 pages artiste.
 *
 * Elles déclaraient un bloc `openGraph` SANS `images` : en Next, déclarer
 * l'objet sans le champ casse l'héritage de l'`opengraph-image` racine — la
 * page se retrouvait donc sans visuel du tout, et la carte Twitter annonçait
 * la home. Un fichier `opengraph-image` par segment est la façon dont Next
 * résout ça, sans toucher au `generateMetadata`.
 *
 * Version texte, comme les groupes et les épisodes.
 */
export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: member } = await supabase
    .from('members')
    .select('stage_name, position, groups!inner(name, is_solo)')
    .eq('slug', slug)
    .maybeSingle()

  const group = member?.groups as unknown as { name: string; is_solo: boolean } | null
  const name = member?.stage_name ?? 'KStage'
  const subtitle = !group
    ? 'Profile & schedule'
    : group.is_solo
      ? 'Soloist — comebacks, MVs & stages'
      : `${group.name}${member?.position ? ` · ${member.position}` : ''}`

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
          fontSize: name.length > 14 ? 84 : 120,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: '#f4f3fa',
          textAlign: 'center',
        }}
      >
        {name}
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
        {subtitle}
      </div>
      <div style={{ display: 'flex', marginTop: 48, fontSize: 30, color: '#cbc9d8' }}>
        KStage — your k-pop calendar
      </div>
    </div>,
    size,
  )
}
