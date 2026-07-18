// Backfill des stage links des épisodes PASSÉS (round 2026-07-18) : la fenêtre
// cron de enrichStageLinks est bornée à 10 jours — le 3 juil. (5/9 stages), le
// 10 juil. (1/8) et tout l'avant-0040 n'étaient plus rattrapables. Ici : la
// même logique, fenêtre élargie au plus vieil event music_show sans stage, et
// pagination profonde (early-stop intégré à enrichStageLinks).
//
//   npx tsx scripts/backfill-stage-links.ts [--since=2026-05-25] [--max-pages=40]
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import { enrichStageLinks } from '../src/lib/scrapers/music-shows/stage-links'

loadEnvConfig(process.cwd())

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_API_KEY manquant')

  let sinceMs: number
  const sinceArg = arg('since')
  if (sinceArg) {
    sinceMs = Date.parse(`${sinceArg}T00:00:00+09:00`)
  } else {
    const { data: oldest } = await supabase
      .from('events')
      .select('start_at')
      .eq('type', 'music_show')
      .is('stage_url', null)
      .lt('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!oldest) {
      console.log('Aucun event music_show passé sans stage.')
      return
    }
    sinceMs = Date.parse(oldest.start_at) - 86_400_000
  }
  const maxPages = Number(arg('max-pages') ?? '40')

  console.log(`Fenêtre depuis ${new Date(sinceMs).toISOString()} · maxPages=${maxPages}`)
  const result = await enrichStageLinks(supabase, apiKey, { sinceMs, maxPages })
  console.log(JSON.stringify(result, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
