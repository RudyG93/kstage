// Lecture des préemptions music-show (결방, table 0063) — jours SANS épisode
// annoncés officiellement par SBS. Consommées par generateShowSlots (pas de
// slot fantôme « Lineup TBA ») ; le check J-1 du cron les lit en service role.

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { kstDayKey } from './date'

export type ShowPreemption = { show_title: string; kst_day: string }

// `cache()` request-scoped : home et calendrier peuvent l'appeler dans le même
// render. Fenêtre = aujourd'hui-KST et plus (les slots ne regardent jamais le
// passé — invariant de generateShowSlots).
export const getUpcomingPreemptions = cache(async (): Promise<ShowPreemption[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('show_preemptions')
    .select('show_title, kst_day')
    .gte('kst_day', kstDayKey(new Date().toISOString()))
  if (error) throw error
  return data ?? []
})
