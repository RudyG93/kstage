/**
 * Application de l'AUTORITÉ Wikipedia sur la numérotation des épisodes.
 *
 * Le parseur et le validateur vivent dans `episode-numbers.ts` (round
 * 2026-07-18) ; ici l'orchestration DB, partagée par
 * `scripts/backfill-episode-numbers.ts` et le cron `aired-shows` — jusqu'au
 * 2026-08-21 la correction n'existait qu'en script manuel, donc en pratique
 * elle ne tournait jamais et 9 épisodes diffusés restaient sans numéro.
 *
 * Règle inchangée : on ne calcule JAMAIS un numéro par arithmétique sur un
 * trou. Une liste d'autorité incohérente n'est pas appliquée du tout.
 */

import type { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { parseChartWinnersWikitext, validateAuthority } from './episode-numbers'

type SupabaseClient = ReturnType<typeof createClient<Database>>

/** show_title DB → page « List of … Chart winners (YYYY) ». */
export const WIKI_PAGES: Record<string, (year: number) => string> = {
  'Music Bank': (y) => `List of Music Bank Chart winners (${y})`,
  Inkigayo: (y) => `List of Inkigayo Chart winners (${y})`,
  'M Countdown': (y) => `List of M Countdown Chart winners (${y})`,
  'Music Core': (y) => `List of Show! Music Core Chart winners (${y})`,
  'Show Champion': (y) => `List of Show Champion Chart winners (${y})`,
  'The Show': (y) => `List of The Show Chart winners (${y})`,
}

export interface AuthorityResult {
  pagesRead: number
  filled: number
  corrected: number
  /** Épisodes sans numéro que l'autorité ne couvre pas non plus. */
  stillMissing: number
  /** Pages écartées car internement contradictoires. */
  incoherent: string[]
  changes: string[]
}

async function fetchWikitext(pageTitle: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
    pageTitle,
  )}&prop=wikitext&format=json`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KStage/1.0 (https://kstage.app; episode numbering)' },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { parse?: { wikitext?: { '*': string } } }
  return data.parse?.wikitext?.['*'] ?? null
}

function dayBounds(kstDay: string): { from: string; to: string } {
  const from = new Date(`${kstDay}T00:00:00+09:00`)
  return { from: from.toISOString(), to: new Date(from.getTime() + 86_400_000).toISOString() }
}

export async function applyEpisodeAuthority(
  supabase: SupabaseClient,
  opts: { apply?: boolean; sinceKstDay?: string } = {},
): Promise<AuthorityResult> {
  const apply = opts.apply ?? true
  const result: AuthorityResult = {
    pagesRead: 0,
    filled: 0,
    corrected: 0,
    stillMissing: 0,
    incoherent: [],
    changes: [],
  }

  let query = supabase
    .from('show_episodes')
    .select('id, show_title, kst_day, episode_number')
    .order('kst_day')
  if (opts.sinceKstDay) query = query.gte('kst_day', opts.sinceKstDay)
  const { data: episodes } = await query
  if (!episodes || episodes.length === 0) return result

  const yearsByShow = new Map<string, Set<number>>()
  for (const e of episodes) {
    const set = yearsByShow.get(e.show_title) ?? new Set<number>()
    set.add(Number(e.kst_day.slice(0, 4)))
    yearsByShow.set(e.show_title, set)
  }

  for (const [show, years] of yearsByShow) {
    const pageOf = WIKI_PAGES[show]
    if (!pageOf) continue
    const authority = new Map<string, number>()
    for (const year of years) {
      const title = pageOf(year)
      const wikitext = await fetchWikitext(title)
      result.pagesRead++
      if (!wikitext) continue
      const parsed = parseChartWinnersWikitext(wikitext, year)
      const problems = validateAuthority(parsed)
      if (problems.length > 0) {
        result.incoherent.push(`${title}: ${problems[0]}`)
        continue
      }
      for (const p of parsed) authority.set(p.date, p.episode)
    }

    for (const row of episodes.filter((e) => e.show_title === show)) {
      const auth = authority.get(row.kst_day)
      if (auth == null) {
        if (row.episode_number == null) result.stillMissing++
        continue
      }
      if (row.episode_number === auth) continue
      if (row.episode_number == null) result.filled++
      else result.corrected++
      result.changes.push(
        `${show} ${row.kst_day} : ${row.episode_number == null ? 'null' : `#${row.episode_number}`} → #${auth}`,
      )
      if (!apply) continue
      await supabase.from('show_episodes').update({ episode_number: auth }).eq('id', row.id)
      // Les rows events du même épisode portent aussi le numéro (affiché sur
      // la tuile) : elles suivent l'autorité dans le même mouvement.
      const { from, to } = dayBounds(row.kst_day)
      await supabase
        .from('events')
        .update({ episode_number: auth })
        .eq('type', 'music_show')
        .eq('title', show)
        .gte('start_at', from)
        .lt('start_at', to)
    }
  }

  return result
}
