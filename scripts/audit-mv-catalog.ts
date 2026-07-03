/**
 * Audit du catalogue MV existant avec les gates durcies (audit prod 2026-07-03) :
 *   1. re-roule `isOfficialMvTitle` (blacklist étendue : 촬영, M/V BTS, MV
 *      Highlight/Sketch, Shorts, Dance Video, Lip ver…) sur tous les type='mv'
 *   2. re-vérifie l'attribution au groupe (`matchesGroup` hashtags strippés —
 *      attrape UAU→Dreamcatcher)
 *   3. batch `videos.list` (contentDetails, 50 ids/call ≈ 1 unit) → durée ;
 *      flag < MIN_MV_DURATION_SEC (teasers/shorts) hors premieres à venir
 *
 * Les FK dépendantes (ratings/comments/likes/notifs) sont ON DELETE CASCADE.
 *
 *   npx tsx scripts/audit-mv-catalog.ts            (dry-run : liste seulement)
 *   npx tsx scripts/audit-mv-catalog.ts --write    (DELETE les flaggés)
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { isOfficialMvTitle } from '../src/lib/scrapers/is-official-mv'
import { matchesGroup } from '../src/lib/scrapers/group-match'
import { parseIsoDuration, MIN_MV_DURATION_SEC } from '../src/lib/scrapers/youtube'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
const YT_KEY = process.env.YOUTUBE_API_KEY!

interface Flagged {
  id: string
  group: string
  title: string
  reason: string
}

function videoIdOf(url: string | null): string | null {
  return url?.match(/[?&]v=([\w-]{11})/)?.[1] ?? null
}

async function fetchDurations(
  ids: string[],
): Promise<Map<string, { sec: number | null; live: string }>> {
  const out = new Map<string, { sec: number | null; live: string }>()
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${chunk.join(',')}&key=${YT_KEY}`,
    )
    if (!res.ok) throw new Error(`videos.list ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = (await res.json()) as {
      items?: {
        id: string
        snippet?: { liveBroadcastContent?: string }
        contentDetails?: { duration?: string }
      }[]
    }
    for (const v of data.items ?? []) {
      out.set(v.id, {
        sec: parseIsoDuration(v.contentDetails?.duration),
        live: v.snippet?.liveBroadcastContent ?? 'none',
      })
    }
  }
  return out
}

async function main() {
  // Pagination explicite : le select Supabase est plafonné à 1000 rows par
  // défaut — sans ça un catalogue > 1000 n'est audité que partiellement.
  type Row = {
    id: string
    title: string
    source_url: string | null
    mv_kind: string | null
    groups: { name: string } | null
  }
  const events: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, source_url, mv_kind, groups!inner(name)')
      .eq('type', 'mv')
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    events.push(...((data ?? []) as Row[]))
    if (!data || data.length < 1000) break
  }
  console.log(`Catalogue : ${events.length} events type='mv'`)

  const flagged: Flagged[] = []
  const flag = (e: (typeof events)[number], reason: string) =>
    flagged.push({ id: e.id, group: e.groups?.name ?? '?', title: e.title, reason })

  // Gates titre + attribution (gratuits).
  const needDuration: (typeof events)[number][] = []
  for (const e of events) {
    const check = isOfficialMvTitle(e.title)
    if (!check.official && check.reason !== 'no-mv-marker') {
      // no-mv-marker exclu : d'anciens titres légitimes sans marqueur ont pu être
      // ingérés par d'autres chemins — on ne purge que les dérivés certains.
      flag(e, check.reason)
      continue
    }
    if (e.groups?.name && !matchesGroup(e.title, e.groups.name)) {
      flag(e, 'group-mismatch (hashtag-only)')
      continue
    }
    needDuration.push(e)
  }

  // Gate durée sur les survivants (≈ n/50 units de quota).
  const byVideoId = new Map<string, (typeof events)[number]>()
  for (const e of needDuration) {
    const vid = videoIdOf(e.source_url)
    if (vid) byVideoId.set(vid, e)
  }
  console.log(`videos.list sur ${byVideoId.size} vidéos (${Math.ceil(byVideoId.size / 50)} calls)…`)
  const durations = await fetchDurations([...byVideoId.keys()])
  let unavailable = 0
  for (const [vid, e] of byVideoId) {
    const d = durations.get(vid)
    if (!d) {
      unavailable++ // vidéo supprimée/privée côté YouTube — signalé, pas purgé
      continue
    }
    if (d.live === 'none' && d.sec !== null && d.sec < MIN_MV_DURATION_SEC) {
      flag(e, `duration:${d.sec}s`)
    }
  }

  console.log(`\n${flagged.length} events flaggés · ${unavailable} vidéos indisponibles côté YT\n`)
  const byReason = new Map<string, Flagged[]>()
  for (const f of flagged) {
    const list = byReason.get(f.reason) ?? []
    list.push(f)
    byReason.set(f.reason, list)
  }
  for (const [reason, list] of [...byReason.entries()].sort()) {
    console.log(`--- ${reason} (${list.length})`)
    for (const f of list) console.log(`    [${f.group}] ${f.title}`)
  }

  if (!WRITE) {
    console.log('\nDry-run. Relancer avec --write pour supprimer.')
    return
  }
  if (flagged.length === 0) return
  const ids = flagged.map((f) => f.id)
  for (let i = 0; i < ids.length; i += 100) {
    const { error: delError } = await supabase
      .from('events')
      .delete()
      .in('id', ids.slice(i, i + 100))
    if (delError) throw delError
  }
  console.log(`\n${ids.length} events supprimés (FK dépendantes en CASCADE).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
