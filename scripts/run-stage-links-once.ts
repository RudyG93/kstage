// Exécution manuelle one-shot de l'enrichissement stage-links (même chemin que
// le cron quotidien) — utile après correction du scoring ou reset d'un lien.
//   npx tsx scripts/run-stage-links-once.ts
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { enrichStageLinks } from '../src/lib/scrapers/music-shows/stage-links'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

enrichStageLinks(supabase, process.env.YOUTUBE_API_KEY!).then((r) => {
  console.log(JSON.stringify(r, null, 2))
})
