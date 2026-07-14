/**
 * Enrichit groups.links (réseaux + plateformes d'écoute) via MusicBrainz url-rels,
 * et rafraîchit groups.image_url via l'image Spotify (plus fraîche que Deezer).
 * Résumable (cache scripts/roster/out/artist-links.json).
 *
 *   npx tsx scripts/roster/seed-artist-links.ts            (fetch + cache, dry-run)
 *   npx tsx scripts/roster/seed-artist-links.ts --write     (fetch manquants + update DB)
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')
const CACHE = 'scripts/roster/out/artist-links.json'
const UA = 'KStage/1.0 (https://kstage.app; contact@kstage.app)'
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// fetch avec 2 retries sur erreur réseau transitoire (socket closed, etc.).
async function fetchRetry(url: string, init?: RequestInit): Promise<Response | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetch(url, init)
    } catch {
      await sleep(1500)
    }
  }
  return null
}

type Links = Record<string, string>
type Entry = { name: string; links: Links; image: string | null }
type Cache = Record<string, Entry>

// Mappe une URL vers une clé de plateforme normalisée (allowlist).
function keyForUrl(u: string): string | null {
  let host: string
  try {
    host = new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
  if (host.includes('instagram.com')) return 'instagram'
  if (host === 'twitter.com' || host === 'x.com' || host.endsWith('.twitter.com')) return 'twitter'
  if (host.includes('tiktok.com')) return 'tiktok'
  if (host.includes('facebook.com')) return 'facebook'
  if (host.includes('weibo.')) return 'weibo'
  if (host === 'music.youtube.com') return 'youtube_music'
  if (host.includes('youtube.com') || host === 'youtu.be') return 'youtube'
  if (host.includes('spotify.com')) return 'spotify'
  if (host.includes('music.apple.com')) return 'apple_music'
  if (host.includes('deezer.com')) return 'deezer'
  if (host.includes('music.amazon')) return 'amazon_music'
  if (host.includes('tidal.com')) return 'tidal'
  if (host.includes('soundcloud.com')) return 'soundcloud'
  return null
}

async function mbid(name: string, isSolo: boolean): Promise<string | null> {
  const res = await fetchRetry(
    // limit=25 : un nom court (« Lisa ») ramène des homonymes mondiaux mieux
    // scorés que l'idole KR — avec limit=5 la vraie Lisa (rang ~17) sortait des
    // résultats et on récupérait le bloc social de LiSA (JP).
    `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(name)}&fmt=json&limit=25`,
    { headers: { 'User-Agent': UA } },
  )
  if (!res || !res.ok) return null
  const artists =
    (
      (await res.json()) as {
        artists?: { id: string; name: string; type?: string; country?: string }[]
      }
    ).artists ?? []
  const wantType = isSolo ? 'Person' : 'Group'
  const matches = artists.filter((a) => norm(a.name) === norm(name))
  // Garde pays : on exige la Corée, ou un match unique. On NE choisit PLUS un
  // homonyme non-KR (l'ancien fallback `type` puis `matches[0]` collait le bloc
  // social de la mauvaise personne — Lisa BLACKPINK → LiSA JP). Un artiste KR
  // sans `country` en base MusicBrainz est accepté seulement s'il est le seul
  // homonyme.
  const pick =
    matches.find((a) => a.type === wantType && a.country === 'KR') ??
    matches.find((a) => a.country === 'KR') ??
    (matches.length === 1 ? matches[0] : null)
  return pick?.id ?? null
}

async function mbLinks(id: string): Promise<Links> {
  const res = await fetchRetry(`https://musicbrainz.org/ws/2/artist/${id}?inc=url-rels&fmt=json`, {
    headers: { 'User-Agent': UA },
  })
  if (!res || !res.ok) return {}
  const rels =
    ((await res.json()) as { relations?: { url?: { resource?: string } }[] }).relations ?? []
  const links: Links = {}
  for (const rel of rels) {
    const url = rel.url?.resource
    if (!url) continue
    const key = keyForUrl(url)
    if (key && !links[key]) links[key] = url
  }
  return links
}

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

// Renvoie { spotify, image } : URL profil + image la plus grande.
async function spotifyArtist(
  name: string,
  token: string,
): Promise<{ spotify: string | null; image: string | null }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchRetry(
      `https://api.spotify.com/v1/search?type=artist&limit=5&q=${encodeURIComponent(name)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res) return { spotify: null, image: null }
    if (res.status === 429) {
      await sleep(Math.min(Number(res.headers.get('Retry-After') ?? '3'), 10) * 1000)
      continue
    }
    if (!res.ok) return { spotify: null, image: null }
    const items =
      (
        (await res.json()) as {
          artists?: {
            items?: {
              name: string
              external_urls?: { spotify?: string }
              images?: { url: string; width: number }[]
            }[]
          }
        }
      ).artists?.items ?? []
    const exact = items.find((a) => a?.name && norm(a.name) === norm(name))
    const a = exact ?? items[0]
    const image = (a?.images ?? []).slice().sort((x, y) => y.width - x.width)[0]?.url ?? null
    return { spotify: a?.external_urls?.spotify ?? null, image }
  }
  return { spotify: null, image: null }
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: groups } = await supabase.from('groups').select('id, name, is_solo, links')
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
    const id = await mbid(g.name, g.is_solo)
    await sleep(1100) // MusicBrainz : 1 req/s
    if (id) {
      Object.assign(links, await mbLinks(id))
      await sleep(1100)
    }
    const { spotify, image } = await spotifyArtist(g.name, token)
    if (spotify && !links.spotify) links.spotify = spotify
    cache[g.id] = { name: g.name, links, image }
    writeFileSync(CACHE, JSON.stringify(cache, null, 2))
    if (++done % 10 === 0) console.log(`  …${done}/${todo.length}`)
    await sleep(300)
  }

  const entries = Object.values(cache)
  const withLinks = entries.filter((e) => Object.keys(e.links).length > 0).length
  const withImg = entries.filter((e) => e.image).length
  console.log(`\n=== ${WRITE ? 'WRITE' : 'DRY-RUN'} ===`)
  console.log(
    `Cached: ${entries.length}/${all.length} | with links: ${withLinks} | with image: ${withImg}`,
  )

  if (!WRITE) {
    console.log('Re-run with --write to push to DB.')
    return
  }
  const byId = new Map(all.map((g) => [g.id, g]))
  let ok = 0
  for (const [id, e] of Object.entries(cache)) {
    const existing = (byId.get(id)?.links ?? {}) as Links
    const merged = { ...existing, ...e.links } // MB/Spotify enrichit, conserve l'existant
    const update: { links: Links; image_url?: string } = { links: merged }
    if (e.image) update.image_url = e.image
    const { error } = await supabase.from('groups').update(update).eq('id', id)
    if (error) console.error(`update ${id} failed:`, error.message)
    else ok++
  }
  console.log(`\nDone. Groups updated: ${ok}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
