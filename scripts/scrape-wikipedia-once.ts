// Lance une fois le scraper de comebacks Wikipedia (2ᵉ source, P0.7) contre la
// prod. Idempotent + dédup cross-source : ne ré-insère rien et ne duplique pas
// ce que kpopofficial couvre déjà. Le cron quotidien fait la même chose ; ce
// script sert au premier remplissage / debug.
//
// Usage : npx tsx scripts/scrape-wikipedia-once.ts
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import { scrapeWikipediaReleases } from '../src/lib/scrapers/wikipedia-releases'

function envLocal(key: string): string {
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`))
  if (!line) throw new Error(`${key} absent de .env.local`)
  return line
    .slice(key.length + 1)
    .replace(/^"|"$/g, '')
    .trim()
}

async function main() {
  const supabase = createClient<Database>(
    envLocal('NEXT_PUBLIC_SUPABASE_URL'),
    envLocal('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const { data: source, error: sErr } = await supabase
    .from('sources')
    .select('id')
    .eq('type', 'wikipedia')
    .maybeSingle()
  if (sErr) throw sErr
  if (!source) throw new Error("source wikipedia absente — seed-la d'abord")

  const { data: groups, error: gErr } = await supabase.from('groups').select('id, slug, name')
  if (gErr) throw gErr

  const r = await scrapeWikipediaReleases(source, groups ?? [], supabase)
  console.log(
    `parsed=${r.parsed} future=${r.future} matched=${r.matched} inserted=${r.inserted} skipped=${r.skipped} pagesFetched=${r.pagesFetched}`,
  )
  if (r.fetchErrors.length) console.error('fetchErrors:', r.fetchErrors)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
