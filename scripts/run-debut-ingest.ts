// Run manuel du pipeline debuts (R4-I) — même code que l'étage 3 du cron
// scrape-comebacks. Sert au premier avalement du stock de la catégorie fandom
// (12 pages/run) et au diagnostic.
//
//   npx tsx scripts/run-debut-ingest.ts
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import { ingestDebuts } from '../src/lib/scrapers/debuts/ingest'

loadEnvConfig(process.cwd())

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const result = await ingestDebuts(supabase, { youtubeKey: process.env.YOUTUBE_API_KEY })
  console.log(JSON.stringify(result, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
