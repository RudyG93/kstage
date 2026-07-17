/**
 * Backfill CIBLÉ des MVs d'une chaîne IMPAGINABLE (Phase 3 Lot 4, audit
 * « fallback pour playlists YouTube incomplètes ») — cas connu : SUCTION sur
 * 1theK, dont la playlist uploads dépasse le cap API 20k items (impaginable).
 *
 * search.list par chaîne + nom du groupe (100 unités/appel) → les hits sont
 * INJECTÉS dans scrapeGroup via opts.uploads : gates titre/durée, dédup ±14 j,
 * slug, mv_kind = exactement le pipeline du cron quotidien, zéro duplication.
 * One-shot manuel (jamais en cron : 100 unités × ~90 sources = intenable).
 *
 *   npx tsx scripts/backfill-mv-search.ts <group-slug> <channelId>
 *   ex: npx tsx scripts/backfill-mv-search.ts suction UCweOkPb1wVVH0Q0Tlj4a5Pw
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { scrapeGroup, type UploadItem } from '../src/lib/scrapers/youtube'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())
const KEY = process.env.YOUTUBE_API_KEY!
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const [slug, channelId] = [process.argv[2], process.argv[3]]
  if (!slug || !channelId) throw new Error('usage: backfill-mv-search.ts <group-slug> <channelId>')

  const { data: group } = await supabase
    .from('groups')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle()
  if (!group) throw new Error(`groupe introuvable: ${slug}`)

  // La source doit exister (posée à la main ou par seed) : le pipeline attribue
  // source_id — on ne crée pas de source ici (décision humaine, chaîne partagée
  // type 1theK ≠ chaîne du groupe).
  const { data: source } = await supabase
    .from('sources')
    .select('id, url, group_id')
    .eq('group_id', group.id)
    .eq('channel_id', channelId)
    .maybeSingle()
  if (!source || !source.group_id) {
    throw new Error(
      `aucune source avec channel_id=${channelId} pour ${slug} — insérer la row sources d'abord`,
    )
  }

  // search.list ciblé chaîne + nom (100 unités) : jusqu'à 50 hits, les gates de
  // scrapeGroup font le tri ensuite.
  const qs = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    channelId,
    q: group.name,
    maxResults: '50',
    key: KEY,
  })
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${qs}`)
  if (!res.ok) throw new Error(`search.list HTTP ${res.status}`)
  const data = (await res.json()) as {
    items?: {
      id?: { videoId?: string }
      snippet?: {
        title?: string
        description?: string
        publishedAt?: string
        thumbnails?: { high?: { url?: string } }
      }
    }[]
  }

  const uploads: UploadItem[] = (data.items ?? [])
    .filter((it) => it.id?.videoId && it.snippet?.title)
    .map((it) => ({
      videoId: it.id!.videoId!,
      title: it.snippet!.title!,
      description: it.snippet!.description ?? '',
      publishedAt: it.snippet!.publishedAt ?? new Date().toISOString(),
      thumbnailUrl: it.snippet!.thumbnails?.high?.url ?? null,
    }))
  console.log(`${uploads.length} hits search pour "${group.name}" sur ${channelId}`)

  const result = await scrapeGroup(
    { id: source.id, url: source.url, group_id: source.group_id },
    KEY,
    supabase,
    { uploads },
  )
  console.log(
    `inserted=${result.inserted} skipped=${result.skipped} premieres=${result.premieres} units=~${result.units + 100}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
