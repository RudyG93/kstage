// Backfill/correction des numéros d'épisodes depuis l'AUTORITÉ Wikipedia
// (« List of {show} Chart winners (YYYY) ») — round 2026-07-18. Les numéros du
// carrd se sont avérés décalés (« Music Bank 1295 » du 17/07 = épisode 1299) ;
// on n'arithmétise JAMAIS un trou : seule l'autorité écrit.
//
//   npx tsx scripts/backfill-episode-numbers.ts            (dry-run)
//   npx tsx scripts/backfill-episode-numbers.ts --apply
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import {
  parseChartWinnersWikitext,
  validateAuthority,
} from '../src/lib/scrapers/music-shows/episode-numbers'

loadEnvConfig(process.cwd())

const APPLY = process.argv.includes('--apply')

// show_title DB → titre de page Wikipedia (année injectée).
const WIKI_PAGES: Record<string, (year: number) => string> = {
  'Music Bank': (y) => `List of Music Bank Chart winners (${y})`,
  Inkigayo: (y) => `List of Inkigayo Chart winners (${y})`,
  'M Countdown': (y) => `List of M Countdown Chart winners (${y})`,
  'Music Core': (y) => `List of Show! Music Core Chart winners (${y})`,
  'Show Champion': (y) => `List of Show Champion Chart winners (${y})`,
  'The Show': (y) => `List of The Show Chart winners (${y})`,
}

async function fetchWikitext(pageTitle: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&format=json`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KStage/1.0 (kstage.vercel.app; data backfill)' },
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    parse?: { wikitext?: { '*': string } }
    error?: { info?: string }
  }
  return data.parse?.wikitext?.['*'] ?? null
}

function kstDayBounds(day: string): { from: string; to: string } {
  const from = new Date(`${day}T00:00:00+09:00`)
  return { from: from.toISOString(), to: new Date(from.getTime() + 86_400_000).toISOString() }
}

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: episodes, error } = await supabase
    .from('show_episodes')
    .select('id, show_title, kst_day, episode_number')
    .order('kst_day')
  if (error) throw new Error(error.message)

  // Années nécessaires par show (The Show a un épisode 2025 en base).
  const yearsByShow = new Map<string, Set<number>>()
  for (const e of episodes ?? []) {
    const set = yearsByShow.get(e.show_title) ?? new Set<number>()
    set.add(Number(e.kst_day.slice(0, 4)))
    yearsByShow.set(e.show_title, set)
  }

  let corrected = 0
  let filled = 0
  let missing = 0
  for (const [show, years] of yearsByShow) {
    const pageOf = WIKI_PAGES[show]
    if (!pageOf) {
      console.warn(`⚠ pas de page d'autorité mappée pour « ${show} »`)
      continue
    }
    const authority = new Map<string, number>()
    for (const year of years) {
      const title = pageOf(year)
      const wikitext = await fetchWikitext(title)
      if (!wikitext) {
        console.warn(`⚠ page absente/illisible : ${title}`)
        continue
      }
      const parsed = parseChartWinnersWikitext(wikitext, year)
      const problems = validateAuthority(parsed)
      if (problems.length > 0) {
        console.warn(`⚠ autorité incohérente (${title}) — NON appliquée :`)
        for (const p of problems) console.warn(`   ${p}`)
        continue
      }
      for (const p of parsed) authority.set(p.date, p.episode)
      console.log(`${title}: ${parsed.length} épisodes d'autorité`)
    }

    for (const row of (episodes ?? []).filter((e) => e.show_title === show)) {
      const auth = authority.get(row.kst_day)
      if (auth == null) {
        if (row.episode_number == null) {
          missing++
          console.log(`  ? ${show} ${row.kst_day} — pas dans l'autorité (reste null)`)
        }
        continue
      }
      if (row.episode_number === auth) continue
      const action =
        row.episode_number == null
          ? `null → #${auth}`
          : `#${row.episode_number} → #${auth} (CORRECTION)`
      console.log(`  ${APPLY ? '→' : '[dry]'} ${show} ${row.kst_day} : ${action}`)
      if (row.episode_number == null) filled++
      else corrected++
      if (!APPLY) continue
      const { error: upErr } = await supabase
        .from('show_episodes')
        .update({ episode_number: auth })
        .eq('id', row.id)
      if (upErr) console.error(`  ✗ show_episodes ${row.id}: ${upErr.message}`)
      // Les rows events du même épisode portent aussi episode_number (affichage).
      const { from, to } = kstDayBounds(row.kst_day)
      const { error: evErr } = await supabase
        .from('events')
        .update({ episode_number: auth })
        .eq('type', 'music_show')
        .eq('title', show)
        .gte('start_at', from)
        .lt('start_at', to)
      if (evErr) console.error(`  ✗ events ${show} ${row.kst_day}: ${evErr.message}`)
    }
  }
  console.log(
    `\n${filled} comblés, ${corrected} corrigés, ${missing} hors autorité${APPLY ? '' : ' (dry-run)'}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
