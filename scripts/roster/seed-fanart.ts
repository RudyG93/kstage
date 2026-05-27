/**
 * Remplit groups.image_landscape avec un backdrop PAYSAGE via TheAudioDB
 * (strArtistFanart, fallback wideThumb/banner). Match par nom normalisé.
 * Dry-run par défaut ; `--write` met à jour. Résumable (cache out/fanart.json).
 *
 *   npx tsx scripts/roster/seed-fanart.ts
 *   npx tsx scripts/roster/seed-fanart.ts --write
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')
const KEY = '2' // clé de test gratuite TheAudioDB
const CACHE = 'scripts/roster/out/fanart.json'
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fanart(name: string): Promise<string | null> {
  let res: Response
  try {
    res = await fetch(
      `https://www.theaudiodb.com/api/v1/json/${KEY}/search.php?s=${encodeURIComponent(name)}`,
    )
  } catch {
    return null
  }
  if (!res.ok) return null
  const a = ((await res.json()) as { artists?: Record<string, string | null>[] }).artists?.[0]
  if (!a || !a.strArtist) return null
  // garde-fou nom (évite un faux match sur un homonyme)
  const nm = norm(a.strArtist)
  if (nm !== norm(name) && !nm.includes(norm(name)) && !norm(name).includes(nm)) return null
  return a.strArtistFanart || a.strArtistWideThumb || a.strArtistBanner || null
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: groups } = await supabase.from('groups').select('id, name')
  const all = groups ?? []

  const cache: Record<string, { name: string; url: string | null }> = existsSync(CACHE)
    ? JSON.parse(readFileSync(CACHE, 'utf8'))
    : {}
  const todo = all.filter((g) => !(g.id in cache))
  console.log(
    `Groups: ${all.length} | cached: ${all.length - todo.length} | to fetch: ${todo.length}`,
  )

  mkdirSync('scripts/roster/out', { recursive: true })
  let done = 0
  for (const g of todo) {
    cache[g.id] = { name: g.name, url: await fanart(g.name) }
    writeFileSync(CACHE, JSON.stringify(cache, null, 2))
    if (++done % 20 === 0) console.log(`  …${done}/${todo.length}`)
    await sleep(450)
  }

  const entries = Object.values(cache)
  const withUrl = entries.filter((e) => e.url)
  console.log(`\n=== ${WRITE ? 'WRITE' : 'FETCH-ONLY'} ===`)
  console.log(`Landscape found: ${withUrl.length}/${all.length}`)
  console.log(
    'Sample URLs:',
    withUrl
      .slice(0, 3)
      .map((e) => e.url)
      .join('\n  '),
  )
  console.log(
    'Missing:',
    entries
      .filter((e) => !e.url)
      .map((e) => e.name)
      .slice(0, 25)
      .join(', '),
  )

  if (!WRITE) {
    console.log('\nFetch-only. Re-run with --write to update groups.image_landscape.')
    return
  }
  let ok = 0
  for (const [id, e] of Object.entries(cache)) {
    if (!e.url) continue
    const { error } = await supabase.from('groups').update({ image_landscape: e.url }).eq('id', id)
    if (error) console.error(`landscape ${id} failed:`, error.message)
    else ok++
  }
  console.log(`\nDone. Groups updated with landscape: ${ok}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
