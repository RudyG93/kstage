import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { discoverChannelsForGroup, seedAndBackfillChannel } from '@/lib/scrapers/channel-discovery'
import { QuotaExceededError } from '@/lib/scrapers/youtube'
import { logScrapeRun, type ScrapeStatus } from '@/lib/scrapers/scrape-log'
import type { Database } from '@/types/database'

// Découverte hebdo de chaînes MV (Phase 3 Lot 3) : pour les groupes à
// catalogue FIN (< 3 MVs) récents ou en quarantaine `candidate`, chercher la
// chaîne qui héberge leurs MVs, la seeder si ≥ 2 MVs title-matchés, backfiller,
// et promouvoir candidate → monitored. Inclure les `candidate` est LE chemin de
// sortie de quarantaine du gate Phase 3 (« un candidat fiable passe de la
// détection à la publication de ses premiers MVs sans intervention »).
//
// Budget quota : ~205 unités/groupe (2 search.list) + backfill (~10/chaîne) →
// MAX_GROUPS_PER_RUN = 3 ≈ 650 unités sur les 10 000/jour (le scrape quotidien
// en consomme ~500). Hebdo (lundi 11:00 UTC) — cf. crons.yml.

const MAX_GROUPS_PER_RUN = 3
const THIN_CATALOG_MVS = 3

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 500 })

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const startedAt = new Date().toISOString()

  // Cibles : TOUT groupe à catalogue fin (élargi 2026-07-17 — le pool limité
  // « debut < 180 j OU candidate » laissait des trous type YENA : une sortie
  // one-off distribuée par un label non seedé chez un artiste établi n'était
  // jamais re-regardée). Les récents restent servis en premier par le tri.
  const { data: pool, error: poolErr } = await supabase
    .from('groups')
    .select('id, name, slug, confidence, debut_date')
    .order('debut_date', { ascending: false, nullsFirst: false })
  if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 })

  // Catalogue fin = < 3 MVs (count par groupe en une requête).
  const ids = (pool ?? []).map((g) => g.id)
  const { data: mvRows } = ids.length
    ? await supabase
        .from('events')
        .select('group_id')
        .eq('type', 'mv')
        .eq('hidden', false)
        .in('group_id', ids)
    : { data: [] }
  const mvCount = new Map<string, number>()
  for (const r of mvRows ?? []) mvCount.set(r.group_id, (mvCount.get(r.group_id) ?? 0) + 1)

  const thin = (pool ?? []).filter((g) => (mvCount.get(g.id) ?? 0) < THIN_CATALOG_MVS)
  // Rotation hebdo déterministe sur le pool élargi : sans elle, les 3 mêmes
  // groupes (une discovery qui ne trouve rien laisse le catalogue fin) seraient
  // re-scannés chaque lundi et le reste du pool jamais visité.
  const week = Math.floor(Date.now() / (7 * 86_400_000))
  const offset = thin.length ? (week * MAX_GROUPS_PER_RUN) % thin.length : 0
  const targets = [...thin.slice(offset), ...thin.slice(0, offset)].slice(0, MAX_GROUPS_PER_RUN)

  let units = 0
  let seeded = 0
  let promoted = 0
  let backfilled = 0
  const review: string[] = []
  const errors: string[] = []
  let quotaHit = false

  for (const group of targets) {
    try {
      const discovery = await discoverChannelsForGroup(group, apiKey)
      units += discovery.units
      // On ne seed que la MEILLEURE chaîne (le multi-chaînes reste une décision
      // humaine — youtube-channels.json).
      const best = discovery.candidates[0]
      if (!best) {
        review.push(`${group.slug}: aucune chaîne candidate`)
        continue
      }
      const result = await seedAndBackfillChannel(supabase, group, best, apiKey)
      if (result.seeded) {
        seeded += 1
        backfilled += result.backfilled
        units += result.units
        if (result.promoted) promoted += 1
      } else {
        review.push(`${group.slug}: ${result.reason} (${best.url})`)
      }
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        quotaHit = true
        errors.push(`quota épuisé sur ${group.slug}`)
        break
      }
      errors.push(`${group.slug}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const status: ScrapeStatus =
    errors.length > 0 && seeded === 0 && targets.length > 0
      ? quotaHit
        ? 'partial' // quota = dégradé temporaire, pas une panne
        : 'error'
      : errors.length > 0
        ? 'partial'
        : 'ok'
  await logScrapeRun(supabase, {
    source: 'channel_discovery',
    status,
    startedAt,
    errorMsg: errors.length > 0 ? errors.join(' | ').slice(0, 500) : undefined,
    details: {
      pool: (pool ?? []).length,
      targets: targets.map((t) => t.slug),
      seeded,
      promoted,
      backfilled,
      units,
      review,
      errors,
    },
  })

  const body = {
    ok: status !== 'error',
    targets: targets.length,
    seeded,
    promoted,
    backfilled,
    units,
  }
  return NextResponse.json(body, { status: status === 'error' ? 500 : 200 })
}
