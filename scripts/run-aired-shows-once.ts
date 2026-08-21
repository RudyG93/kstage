// Reconstruction des épisodes music-show depuis les chaînes des diffuseurs.
// Dry-run par défaut : rien n'est écrit tant que --apply n'est pas passé.
//   npx tsx scripts/run-aired-shows-once.ts --since 2026-05-25 --pages 40
//   npx tsx scripts/run-aired-shows-once.ts --since 2026-05-25 --pages 40 --apply
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { scanAiredShows } from '../src/lib/scrapers/music-shows/aired-lineups'
import { applyEpisodeAuthority } from '../src/lib/scrapers/music-shows/episode-authority'
import type { ShowId } from '../src/lib/scrapers/music-shows/types'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

scanAiredShows(supabase, process.env.YOUTUBE_API_KEY!, {
  apply: process.argv.includes('--apply'),
  sinceKstDay: arg('since'),
  maxPages: arg('pages') ? Number(arg('pages')) : undefined,
  shows: arg('show') ? ([arg('show')] as ShowId[]) : undefined,
}).then(async (r) => {
  console.log(
    `units=${r.units}  episodes+${r.episodesCreated}  numeros+${r.numbersFilled}  passages+${r.eventsCreated}  stages+${r.stagesLinked}  numsync=${r.numbersSynced}`,
  )
  console.log('--- byShow ---')
  for (const [show, s] of Object.entries(r.byShow)) {
    console.log(
      `  ${show.padEnd(14)} eps=${s.episodes} +ep=${s.episodesCreated} +num=${s.numbersFilled} +passages=${s.eventsCreated} +stages=${s.stagesLinked}/${s.stagePending} (cand=${s.stageCandidates}) nonconfirmes=${s.unconfirmed.length}`,
    )
  }
  console.log('--- creations ---')
  for (const c of r.created) console.log('  ' + c)
  console.log('--- passages non confirmes par la video ---')
  for (const u of r.unconfirmed) console.log('  ' + u)
  if (r.errors.length) {
    console.log('--- erreurs ---')
    for (const e of r.errors) console.log('  ' + e)
  }
  const auth = await applyEpisodeAuthority(supabase, {
    apply: process.argv.includes('--apply'),
    sinceKstDay: arg('since'),
  })
  console.log(
    `--- autorite Wikipedia : ${auth.filled} combles, ${auth.corrected} corriges, ${auth.stillMissing} hors autorite (${auth.pagesRead} pages) ---`,
  )
  for (const c of auth.changes) console.log('  ' + c)
  for (const i of auth.incoherent) console.log('  ! ' + i)
})
