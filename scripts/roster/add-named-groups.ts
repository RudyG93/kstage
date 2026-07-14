// Ajout ciblé de groupes populaires manquants par NOM (R10) — rattrape
// immédiatement des groupes précis sans attendre le backfill alphabétique du
// cron. Réutilise createFromPayload (dossier complet). Non-destructif.
//
//   npx tsx scripts/roster/add-named-groups.ts
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'
import { ingestNamedGroups } from '../../src/lib/scrapers/debuts/ingest'

loadEnvConfig(process.cwd())

// Groupes actifs/suivis absents du roster (vérifiés R10). Le gate de découverte
// ne les atteignait pas (forward-only). createFromPayload filtre les absents.
const NAMES = [
  'RESCENE',
  'PLAVE',
  'UNIS',
  'NEXZ',
  'BADVILLAIN',
  'me:I',
  'KickFlip',
  'CORTIS',
  'Candy Shop',
  'POW',
  'NOWADAYS',
  'YOUNITE',
  'n.SSign',
  'ARrC',
  'AHOF',
]

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const result = await ingestNamedGroups(supabase, NAMES, {
    youtubeKey: process.env.YOUTUBE_API_KEY,
  })
  console.log(JSON.stringify(result, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
