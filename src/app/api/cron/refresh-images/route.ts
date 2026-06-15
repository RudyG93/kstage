import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { spotifyToken, spotifyArtist } from '@/lib/spotify'

// Rafraîchit groups.image_url + groups.spotify_followers depuis Spotify (§10 + §4.3) —
// un seul search renvoie les deux. Vercel Cron déclenche en GET + en-tête
// Authorization: Bearer ${CRON_SECRET}. `?limit=N` traite un sous-ensemble (batch / test).

export const maxDuration = 300

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

  const limit = Number(new URL(req.url).searchParams.get('limit') ?? '0')
  let query = supabase.from('groups').select('id, name').order('name')
  if (limit > 0) query = query.limit(limit)
  const { data: groups, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let updated = 0
  let missed = 0
  for (const g of groups ?? []) {
    const { image, followers } = await spotifyArtist(g.name, token)
    // On n'écrase que les champs que Spotify renvoie : un groupe sans match garde
    // son image actuelle (Deezer/admin) et ses followers, jamais de null.
    const patch: { image_url?: string; spotify_followers?: number } = {}
    if (image) patch.image_url = image
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

  return NextResponse.json({ ok: true, total: groups?.length ?? 0, updated, missed })
}
