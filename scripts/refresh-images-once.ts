// Runner local one-off du pipeline images (R4-B) — même logique que le cron
// /api/cron/refresh-images (src/lib/images/refresh.ts), en batch complet :
// tous les groupes (Spotify by-ID + garde), toutes les bannières YT, et un
// gros lot de photos membres fandom (--photos=600 = tout le roster d'un coup).
//
//   npx tsx scripts/refresh-images-once.ts [--photos=600]
//   npx tsx scripts/refresh-images-once.ts --stale   (photos stale uniquement,
//     photo_source_key null — comble la classe « incohérence d'ère » d'un coup)
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import { spotifyToken } from '../src/lib/spotify'
import {
  refreshGroupImages,
  refreshYtBanners,
  refreshMemberPhotos,
} from '../src/lib/images/refresh'

loadEnvConfig(process.cwd())

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  // --stale : ne rejoue QUE la phase photos, sur les membres jamais sourcés
  // fandom (photo_source_key null). Combats la classe « split d'ère » sans
  // retoucher images groupes/bannières.
  const staleOnly = process.argv.includes('--stale')
  const photoBatch = Number(arg('photos') ?? '600')

  if (!staleOnly) {
    const token = await spotifyToken()
    if (!token) throw new Error('Spotify credentials manquantes')

    console.log('— Phase 1 : images Spotify by-ID —')
    const images = await refreshGroupImages(supabase, token)
    console.log(JSON.stringify(images, null, 2))

    console.log('\n— Phase 2 : bannières YouTube —')
    const banners = await refreshYtBanners(supabase, process.env.YOUTUBE_API_KEY!)
    console.log(JSON.stringify(banners, null, 2))
  }

  console.log(
    `\n— Phase 3 : photos membres fandom (batch=${photoBatch}${staleOnly ? ', stale only' : ''}) —`,
  )
  const photos = await refreshMemberPhotos(supabase, { batch: photoBatch, staleOnly })
  console.log(JSON.stringify(photos, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
