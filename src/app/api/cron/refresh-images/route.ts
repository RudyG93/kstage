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

  // Ce qui dégrade un run, c'est ce qui l'a EMPÊCHÉ de faire son travail — pas
  // une donnée connue à corriger. Avant le 2026-08-21 c'était l'inverse : un
  // seul nom d'artiste en coréen (StelLive) mettait le run en `partial` tous
  // les jours depuis le 16/08, donc le monitor en alerte, donc le job GitHub
  // rouge ; pendant qu'un run où **166 appels Spotify sur 167** avaient échoué
  // (quota) passait pour `ok` (2026-08-20 23:08). Même leçon que le `partial`
  // permanent de scrape-youtube : un statut qui crie au loup n'est plus lu.
  // Les mismatches restent visibles — details.images.mismatches et le check
  // `spotify_link_mismatch` de /admin/health.
  const imagesBroken = images.aborted !== null || images.apiErrors > images.total / 4
  // La phase 3 n'avait AUCUN signal capable de détecter une panne de résolution
  // fandom : `failures` compte par membre, alors qu'une coupure fait échouer par
  // LOT de 5 — le seuil `failures > checked / 2` était donc inatteignable, et
  // les 100 membres du run ressortaient avec `photo_checked_at` rafraîchi.
  const photosBroken =
    photos.apiBlocked ||
    photos.batchFailures > 0 ||
    photos.apiErrors > 0 ||
    (photos.checked > 0 && photos.failures > photos.checked / 2)
  const degraded = imagesBroken || photosBroken

  const reasons = [
    images.aborted?.reason === 'rate_limited'
      ? `spotify quota épuisé (retry-after ${images.aborted.retryAfterSec ?? '?'} s, ${images.aborted.skipped} groupes non tentés)`
      : null,
    images.aborted?.reason === 'auth' ? 'spotify 401/403 — credentials ou app restreinte' : null,
    images.apiErrors > images.total / 4 ? `spotify ${images.apiErrors} erreurs API` : null,
    photos.apiBlocked ? 'fandom api.php 403 — re-router la phase photos' : null,
    photos.batchFailures > 0 ? `fandom: ${photos.batchFailures} lots injoignables` : null,
    photos.apiErrors > 0 ? `fandom: ${photos.apiErrors} réponses non-2xx` : null,
    photos.checked > 0 && photos.failures > photos.checked / 2
      ? `photos: ${photos.failures}/${photos.checked} en échec`
      : null,
  ].filter(Boolean)

  await logScrapeRun(supabase, {
    source: 'refresh_images',
    status: degraded ? 'partial' : 'ok',
    startedAt,
    errorMsg: reasons.length > 0 ? reasons.join(' ; ') : null,
    details: summary,
  })

  return NextResponse.json({ ok: true, ...summary })
}
