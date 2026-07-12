import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { spotifyToken } from '@/lib/spotify'
import { refreshGroupImages, refreshYtBanners, refreshMemberPhotos } from '@/lib/images/refresh'
import { logScrapeRun } from '@/lib/scrapers/scrape-log'

// Fraîcheur des images (quotidien depuis R4-B — la rotation photos membres a
// besoin du rythme journalier) : 3 phases, logique partagée dans
// src/lib/images/refresh.ts (le runner local one-off l'utilise aussi).
//   1. groups.image_url ← Spotify PAR ID + garde de nom (fini le search par
//      nom dont le repli items[0] a écrit « Weird Al » Yankovic sur WEi)
//   2. groups.banner_yt_url ← bannière YT de la chaîne exclusive (=w2560)
//   3. members.photo_url ← kpop.fandom, ~100 membres/jour en rotation
// Deezer et TheAudioDB SUPPRIMÉS : par-nom donc même classe d'erreur que
// Weird Al, et TheAudioDB = les fanarts 2018-2021 dénoncés deux rounds de
// suite. Vercel Cron : GET + Authorization: Bearer ${CRON_SECRET}.
// `?limit=N` (groupes) et `?photo_batch=N` = overrides de test/one-off.

export const maxDuration = 300

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
  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') ?? '0') || undefined
  const photoBatch = Number(url.searchParams.get('photo_batch') ?? '0') || undefined

  const images = await refreshGroupImages(supabase, token, { limit })

  const ytKey = process.env.YOUTUBE_API_KEY
  const banners = ytKey
    ? await refreshYtBanners(supabase, ytKey)
    : { channels: 0, updated: 0, sharedOnly: 0, units: 0 }

  const photos = await refreshMemberPhotos(supabase, { batch: photoBatch })

  const summary = { images, banners, photos }
  const degraded =
    images.mismatches.length > 0 || photos.apiBlocked || photos.failures > photos.checked / 2
  await logScrapeRun(supabase, {
    source: 'refresh_images',
    status: degraded ? 'partial' : 'ok',
    startedAt,
    errorMsg: photos.apiBlocked
      ? 'fandom api.php 403 — re-router la phase photos'
      : images.mismatches.length > 0
        ? `spotify name mismatches: ${images.mismatches.join('; ')}`
        : null,
    details: summary,
  })

  return NextResponse.json({ ok: true, ...summary })
}
