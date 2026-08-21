import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { discoverChannelsForGroup, seedAndBackfillChannel } from '@/lib/scrapers/channel-discovery'
import { QuotaExceededError, scrapeGroup } from '@/lib/scrapers/youtube'
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

// Débit relevé 10→20 (audit 2026-08-20, APRÈS le fix du no-op « source déjà
// présente » : l'élargir avant n'aurait que doublé le gaspillage) : cycle du
// pool ~10 semaines → ~5. ~205 units/groupe × 20 ≈ 4 100/lundi — tient dans
// les 10 000/jour avec le scrape quotidien (~1 900).
// Débit ramené 20 → 3 (nuit 2026-08-21) : ce cron a consommé 3 884 units le
// 20/08 et fini en HTTP 429, épuisant le quota de RECHERCHE pour la journée —
// c'est lui qui rendait les remèdes de /admin/health inopérants. La
// récupération des MV passe désormais par `recover-mvs` (discographie fandom,
// ~2 units/groupe, tout le pool en un run). `discover-channels` reste utile
// pour DÉCOUVRIR une chaîne à scraper en continu, mais devient un complément
// à petit débit, pas le moteur principal.
const MAX_GROUPS_PER_RUN = 3
// Seuil « fin » : ≤ 5 MVs, une page groupe paraît vide — ALIGNÉ sur le check
// santé thin_mv_catalogs (audit 2026-08-20 : le `<` strict excluait à jamais
// les 12 groupes à exactement 5 MVs, drain impossible par construction).
const THIN_CATALOG_MVS = 5

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
    .select('id, name, name_aliases, slug, confidence, debut_date, agency')
    .order('debut_date', { ascending: false, nullsFirst: false })
  if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 })

  // Catalogue fin = < THIN_CATALOG_MVS MVs. ⚠️ Fetch PAGINÉ : le select simple
  // plafonnait silencieusement à 1000 rows (>2400 MVs en base) → counts faux et
  // pool « thin » pollué (bug préexistant repéré au round 2026-07-18).
  const mvCount = new Map<string, number>()
  for (let from = 0; ; from += 1000) {
    const { data: mvRows } = await supabase
      .from('events')
      .select('group_id')
      .eq('type', 'mv')
      .eq('hidden', false)
      .range(from, from + 999)
    for (const r of mvRows ?? []) {
      if (r.group_id) mvCount.set(r.group_id, (mvCount.get(r.group_id) ?? 0) + 1)
    }
    if (!mvRows || mvRows.length < 1000) break
  }

  const thin = (pool ?? []).filter((g) => (mvCount.get(g.id) ?? 0) <= THIN_CATALOG_MVS)
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
      if (discovery.candidates.length === 0) {
        review.push(`${group.slug}: aucune chaîne candidate`)
        continue
      }
      // Itération des candidats (audit 2026-08-20) : candidates[0] seul → 58 %
      // des visites finissaient en no-op « source déjà présente » (~200 unités
      // de search gaspillées). On seed le PREMIER candidat absent de la base ;
      // tout autre motif de refus (anti-homonyme, insert KO) reste bloquant.
      let seededThis = false
      let lastReason = ''
      for (const candidate of discovery.candidates) {
        const result = await seedAndBackfillChannel(supabase, group, candidate, apiKey)
        if (result.seeded) {
          seeded += 1
          backfilled += result.backfilled
          units += result.units
          if (result.promoted) promoted += 1
          seededThis = true
          break
        }
        lastReason = `${result.reason} (${candidate.url})`
        if (result.reason !== 'source déjà présente') break
      }
      if (!seededThis) {
        if (lastReason.startsWith('source déjà présente')) {
          // Tous les candidats sont déjà seedés : deep re-scan de la meilleure
          // source existante à la place du skip sec — la recherche (~200 u) est
          // déjà payée, le re-scan n'en coûte ~20 et peut combler le catalogue.
          const { data: existingSource } = await supabase
            .from('sources')
            .select('id, url, group_id')
            .eq('group_id', group.id)
            .eq('type', 'youtube_api')
            .order('subscriber_count', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle()
          if (existingSource?.group_id) {
            const rescan = await scrapeGroup(
              {
                id: existingSource.id,
                url: existingSource.url,
                group_id: existingSource.group_id,
              },
              apiKey,
              supabase,
              { maxPages: 20 },
            )
            units += rescan.units
            backfilled += rescan.inserted
            review.push(
              `${group.slug}: candidats déjà seedés → deep re-scan (+${rescan.inserted} MV)`,
            )
          } else {
            review.push(`${group.slug}: ${lastReason}`)
          }
        } else {
          review.push(`${group.slug}: ${lastReason}`)
        }
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
