// Synchronisation des préemptions 결방 (2026-08-19) : les boards SBS publient
// des avis officiels de déprogrammation (« [결방 공지] 8월 2일(일), 8월 9일(일)
// SBS 인기가요 » constaté le 08/08). Sans eux, le monitor alertait « J-1 sans
// lineup » sur un épisode inexistant et le calendrier affichait un slot
// fantôme. Appelé best-effort par le cron scrape-music-shows (2 fetchs
// Jina/run). Seuls les boards SBS exposent ce format ; les autres shows
// n'ont pas de source de préemption connue — couverture partielle assumée.

import type { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { parseBoardPreemptions } from './sources/sbs-board'
import { BOARD_URL as INKIGAYO_BOARD_URL } from './sources/sbs-inkigayo'
import { BOARD_URL as THE_SHOW_BOARD_URL } from './sources/sbs-the-show'

type SupabaseClient = ReturnType<typeof createClient<Database>>

// show_title = displayName du descriptor (clé des slots ET de show_episodes).
const BOARDS = [
  { showTitle: 'Inkigayo', boardUrl: INKIGAYO_BOARD_URL },
  { showTitle: 'The Show', boardUrl: THE_SHOW_BOARD_URL },
] as const

export async function syncSbsPreemptions(
  supabase: SupabaseClient,
  todayKstKey: string,
): Promise<{ upserted: number; errors: string[] }> {
  let upserted = 0
  const errors: string[] = []
  for (const board of BOARDS) {
    try {
      const res = await fetch(`https://r.jina.ai/${board.boardUrl}`, {
        headers: { 'user-agent': 'KStageBot/0.1 (+https://kstage.vercel.app)' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Passé exclu : les slots ne regardent jamais en arrière, et un avis
      // périmé re-parsé ne doit pas réécrire l'histoire.
      const rows = parseBoardPreemptions(await res.text()).filter((p) => p.kstDay >= todayKstKey)
      if (rows.length > 0) {
        const { error } = await supabase.from('show_preemptions').upsert(
          rows.map((p) => ({
            show_title: board.showTitle,
            kst_day: p.kstDay,
            source_url: p.postUrl,
          })),
          { onConflict: 'show_title,kst_day', ignoreDuplicates: true },
        )
        if (error) throw new Error(error.message)
        upserted += rows.length
      }
    } catch (err) {
      errors.push(`${board.showTitle}: ${String(err)}`)
    }
  }
  return { upserted, errors }
}
