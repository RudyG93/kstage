import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { SHOW_DESCRIPTORS } from '@/lib/scrapers/music-shows/types'
import { formatKst, kstDayBounds } from '@/lib/events/date'

export const alt = 'Music show episode on KStage'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * OG des pages épisode — elles servaient celle de la HOME : un partage de
 * « Music Bank #1304 » affichait le slogan du site et `og:url = kstage.app`.
 *
 * Version TEXTE, comme celle des groupes : la variante riche (photo distante
 * en ArrayBuffer + police custom fetchée à chaque génération) est conditionnée
 * à des partages qui n'existent pas encore, et « OG photo + Archivo » est déjà
 * parqué au JOURNAL. Client anon nu : pas de cookies dans ce contexte.
 */
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ show: string; day: string }>
}) {
  const { show, day } = await params
  const descriptor = SHOW_DESCRIPTORS.find((s) => s.id === show)
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  let title = descriptor?.displayName ?? 'Music show'
  let dateLine = ''
  let lineup = 'Lineup, stages & discussion'
  if (descriptor && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const { data: episode } = await supabase
      .from('show_episodes')
      .select('episode_number, start_at')
      .eq('show_title', descriptor.displayName)
      .eq('kst_day', day)
      .maybeSingle()
    if (episode) {
      if (episode.episode_number) title = `${descriptor.displayName} #${episode.episode_number}`
      dateLine = formatKst(episode.start_at, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      const { from, to } = kstDayBounds(episode.start_at)
      const { data: rows } = await supabase
        .from('events')
        .select('groups!inner(name)')
        .eq('type', 'music_show')
        .eq('title', descriptor.displayName)
        .eq('hidden', false)
        .gte('start_at', from)
        .lt('start_at', to)
        .order('start_at', { ascending: true })
        .limit(8)
      const names = (rows ?? [])
        .map((r) => (r.groups as unknown as { name: string } | null)?.name)
        .filter(Boolean)
      if (names.length > 0) lineup = names.join(' · ')
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
          fontSize: title.length > 18 ? 76 : 104,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: '#f4f3fa',
          textAlign: 'center',
        }}
      >
        {title}
      </div>
      {dateLine && (
        <div style={{ display: 'flex', marginTop: 18, fontSize: 34, color: '#3fe0b8' }}>
          {dateLine} KST
        </div>
      )}
      <div
        style={{
          display: 'flex',
          marginTop: 28,
          fontSize: 28,
          color: '#cbc9d8',
          textAlign: 'center',
          maxWidth: 1000,
        }}
      >
        {lineup.length > 110 ? `${lineup.slice(0, 110)}…` : lineup}
      </div>
      <div style={{ display: 'flex', marginTop: 40, fontSize: 26, color: '#8b89a0' }}>
        KStage — your k-pop calendar
      </div>
    </div>,
    size,
  )
}
