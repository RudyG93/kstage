import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { spotifyToken, spotifyArtist } from '@/lib/spotify'
import { logScrapeRun } from '@/lib/scrapers/scrape-log'

// Rafraîchit les images de groupes (hebdo, lundi 4h) :
//   1. groups.image_url + spotify_followers via Spotify (source la plus fraîche)
//   2. fallback Deezer quand Spotify ne matche pas (audit 2026-07-03 : un miss
//      Spotify laissait l'image figée au seed pour toujours)
//   3. groups.image_landscape : remplit les MANQUANTS via TheAudioDB (12/run —
//      leur data bouge peu, la fraîcheur du hero vient du thumbnail du dernier
//      MV, pas d'ici)
// Observabilité : ligne scrape_log par run (il n'en écrivait aucune).
// Vercel Cron : GET + Authorization: Bearer ${CRON_SECRET}. `?limit=N` = batch/test.

export const maxDuration = 300

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')

/** Image d'artiste Deezer (picture_xl), avec garde-fou de nom. */
async function deezerArtistImage(name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}`)
    if (!res.ok) return null
    const data = (await res.json()) as { data?: { name?: string; picture_xl?: string }[] }
    const hit = data.data?.[0]
    if (!hit?.name || !hit.picture_xl) return null
    const a = norm(hit.name)
    const b = norm(name)
    if (a !== b && !a.includes(b) && !b.includes(a)) return null
    return hit.picture_xl
  } catch {
    return null
  }
}

/** Backdrop paysage TheAudioDB (fanart → wideThumb → banner), garde-fou de nom. */
async function audioDbLandscape(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(name)}`,
    )
    if (!res.ok) return null
    const a = ((await res.json()) as { artists?: Record<string, string | null>[] }).artists?.[0]
    if (!a?.strArtist) return null
    const nm = norm(a.strArtist)
    const target = norm(name)
    if (nm !== target && !nm.includes(target) && !target.includes(nm)) return null
    return a.strArtistFanart || a.strArtistWideThumb || a.strArtistBanner || null
  } catch {
    return null
  }
}

const LANDSCAPE_BATCH = 12

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = await spotifyToken()
  if (!token) {
    return NextResponse.json({ error: 'Spotify credentials missing or invalid' }, { status: 500 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const startedAt = new Date().toISOString()

  const limit = Number(new URL(req.url).searchParams.get('limit') ?? '0')
  let query = supabase.from('groups').select('id, name, image_landscape').order('name')
  if (limit > 0) query = query.limit(limit)
  const { data: groups, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let updated = 0
  let deezerFallbacks = 0
  let missed = 0
  for (const g of groups ?? []) {
    const { image, followers } = await spotifyArtist(g.name, token)
    // On n'écrase que ce qu'une source renvoie : un miss garde l'image actuelle.
    const patch: { image_url?: string; spotify_followers?: number } = {}
    if (image) patch.image_url = image
    else {
      const deezer = await deezerArtistImage(g.name)
      if (deezer) {
        patch.image_url = deezer
        deezerFallbacks++
      }
    }
    if (followers != null) patch.spotify_followers = followers

    if (Object.keys(patch).length > 0) {
      const { error: upErr } = await supabase.from('groups').update(patch).eq('id', g.id)
      if (upErr) console.error(`refresh-images update ${g.id} failed: ${upErr.message}`)
      else updated++
    } else {
      missed++
    }
    await sleep(200)
  }

  // Landscapes manquants (batch borné — TheAudioDB clé de test = throttle doux).
  const missingLandscape = (groups ?? [])
    .filter((g) => !g.image_landscape)
    .slice(0, LANDSCAPE_BATCH)
  let landscapesFilled = 0
  for (const g of missingLandscape) {
    const url = await audioDbLandscape(g.name)
    if (url) {
      const { error: upErr } = await supabase
        .from('groups')
        .update({ image_landscape: url })
        .eq('id', g.id)
      if (!upErr) landscapesFilled++
    }
    await sleep(350)
  }

  const summary = {
    total: groups?.length ?? 0,
    updated,
    deezer_fallbacks: deezerFallbacks,
    missed,
    landscapes_missing: (groups ?? []).filter((g) => !g.image_landscape).length,
    landscapes_filled: landscapesFilled,
  }
  await logScrapeRun(supabase, {
    source: 'refresh_images',
    status: missed === (groups?.length ?? 0) && (groups?.length ?? 0) > 0 ? 'partial' : 'ok',
    startedAt,
    errorMsg: null,
    details: summary,
  })

  return NextResponse.json({ ok: true, ...summary })
}
