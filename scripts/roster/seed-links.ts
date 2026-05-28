/**
 * Capture les liens streaming (Spotify + Deezer) par groupe → groups.links (JSONB).
 * Résumable (cache scripts/roster/out/links.json) + sans hang (abandonne Spotify
 * après quelques 429). Dry-run = fetch only ; `--write` = fetch (résumable) puis update DB.
 *
 *   npx tsx scripts/roster/seed-links.ts            (fetch + cache)
 *   npx tsx scripts/roster/seed-links.ts --write     (fetch manquants + update DB)
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')
const CACHE = 'scripts/roster/out/links.json'
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Links = Record<string, string>
type Cache = Record<string, { name: string; links: Links }>

async function spotifyToken(): Promise<string> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  return ((await res.json()) as { access_token: string }).access_token
}

// max 2 retries sur 429 puis abandon (null) — jamais de hang.
async function spotifyLink(name: string, token: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://api.spotify.com/v1/search?type=artist&limit=5&q=${encodeURIComponent(name)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (res.status === 429) {
      const wait = Math.min(Number(res.headers.get('Retry-After') ?? '3'), 10) * 1000
      await sleep(wait)
      continue
    }
    if (!res.ok) return null
    const items =
      (
        (await res.json()) as {
          artists?: { items?: { name: string; external_urls?: { spotify?: string } }[] }
        }
      ).artists?.items ?? []
    const exact = items.find((a) => a?.name && norm(a.name) === norm(name))
    return (exact ?? items[0])?.external_urls?.spotify ?? null
  }
  return null // rate-limité : on laisse, reprise possible au prochain run
}

async function deezerLink(name: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://api.deezer.com/search/artist?limit=5&q=${encodeURIComponent(name)}`,
    )
    if (res.status === 429) {
      await sleep(2000)
      continue
    }
    if (!res.ok) return null
    const items = ((await res.json()) as { data?: { name: string; link?: string }[] }).data ?? []
    const exact = items.find((a) => a?.name && norm(a.name) === norm(name))
    return (exact ?? items[0])?.link ?? null
  }
  return null
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: groups } = await supabase.from('groups').select('id, name')
  const all = groups ?? []

  const cache: Cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}
  const todo = all.filter((g) => !(g.id in cache))
  console.log(
    `Groups: ${all.length} | cached: ${all.length - todo.length} | to fetch: ${todo.length}`,
  )

  const token = await spotifyToken()
  mkdirSync('scripts/roster/out', { recursive: true })
  let done = 0
  for (const g of todo) {
    const links: Links = {}
    const sp = await spotifyLink(g.name, token)
    if (sp) links.spotify = sp
    const dz = await deezerLink(g.name)
    if (dz) links.deezer = dz
    cache[g.id] = { name: g.name, links }
    writeFileSync(CACHE, JSON.stringify(cache, null, 2)) // résumable : sauve à chaque pas
    if (++done % 20 === 0) console.log(`  …${done}/${todo.length}`)
    await sleep(350)
  }

  const entries = Object.values(cache)
  const spot = entries.filter((e) => e.links.spotify).length
  const deez = entries.filter((e) => e.links.deezer).length
  console.log(`\n=== ${WRITE ? 'WRITE' : 'FETCH-ONLY'} ===`)
  console.log(`Cached: ${entries.length}/${all.length} | spotify: ${spot} | deezer: ${deez}`)

  if (!WRITE) {
    console.log('Re-run with --write to push to DB (reprend le cache, re-fetche les manquants).')
    return
  }
  let ok = 0
  for (const [id, e] of Object.entries(cache)) {
    const { error } = await supabase.from('groups').update({ links: e.links }).eq('id', id)
    if (error) console.error(`links ${id} failed:`, error.message)
    else ok++
  }
  console.log(`\nDone. Groups updated with links: ${ok}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
