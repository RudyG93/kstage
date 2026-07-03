import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { aggregateLineups } from '@/lib/scrapers/music-shows/aggregator'
import { SOURCE_URL } from '@/lib/scrapers/music-shows/sources/live-show-updates'
import { extractCanonicalName } from '@/lib/scrapers/music-shows/canonical'
import { SHOW_DESCRIPTORS, type ShowId } from '@/lib/scrapers/music-shows/types'
import { logScrapeRun } from '@/lib/scrapers/scrape-log'
// normalize partagé (Unicode-aware) : matche aussi les noms hangul des lineups —
// la copie locale ASCII-only les ratait (DRY, audit 2026-07-03).
import { normalize } from '@/lib/scrapers/group-match'

// Vercel Cron déclenche en GET et ajoute l'en-tête Authorization: Bearer ${CRON_SECRET}.

// Aliases DB ↔ noms scrappés (aligné src/lib/scrapers/kpopofficial.ts:80).
const GROUP_ALIASES: Record<string, string> = {
  gidle: 'idle',
}

interface GroupRef {
  id: string
  slug: string
  name: string
}

function matchGroup(artistName: string, groups: readonly GroupRef[]): GroupRef | null {
  const key = normalize(artistName)
  if (!key) return null
  for (const g of groups) {
    if (normalize(g.name) === key || normalize(g.slug) === key) return g
  }
  const aliasSlug = GROUP_ALIASES[key]
  if (aliasSlug) return groups.find((g) => g.slug === aliasSlug) ?? null
  return null
}

const SHOW_DISPLAY_NAME: Record<ShowId, string> = Object.fromEntries(
  SHOW_DESCRIPTORS.map((s) => [s.id, s.displayName]),
) as Record<ShowId, string>

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .select('id')
    .eq('url', SOURCE_URL)
    .maybeSingle()
  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 })
  if (!source) return NextResponse.json({ error: 'music-shows source not seeded' }, { status: 500 })

  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id, slug, name')
  if (groupsError) return NextResponse.json({ error: groupsError.message }, { status: 500 })
  const groupRefs: GroupRef[] = (groups ?? []).map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
  }))

  const startedAt = new Date().toISOString()
  const aggregateResult = await aggregateLineups()

  let created = 0
  let matchedTotal = 0
  const unmatched: string[] = []
  const byShow: Record<string, { matched: number; created: number; skipped: number }> = {}

  for (const lineup of aggregateResult.lineups) {
    const showStats = (byShow[lineup.show] ??= { matched: 0, created: 0, skipped: 0 })
    const showLabel = SHOW_DISPLAY_NAME[lineup.show]

    for (const artistRaw of lineup.artistsRaw) {
      const canonical = extractCanonicalName(artistRaw)
      if (!canonical) continue
      const group = matchGroup(canonical, groupRefs)
      if (!group) {
        unmatched.push(`${lineup.show}/${canonical}`)
        continue
      }
      matchedTotal++
      showStats.matched++

      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('group_id', group.id)
        .eq('type', 'music_show')
        .eq('start_at', lineup.startAtIso)
        .eq('source_url', SOURCE_URL)
        .maybeSingle()
      if (existing) {
        showStats.skipped++
        continue
      }

      const { error: insertErr } = await supabase.from('events').insert({
        group_id: group.id,
        source_id: source.id,
        source_url: SOURCE_URL,
        type: 'music_show',
        title: showLabel,
        episode_number: lineup.episodeNumber,
        start_at: lineup.startAtIso,
        status: lineup.isHighlight ? 'tentative' : 'confirmed',
      })
      if (insertErr) {
        console.error(`music-shows insert failed: ${insertErr.message}`)
        showStats.skipped++
        continue
      }
      created++
      showStats.created++
    }
  }

  // P0.3 observabilité (SCRAPING.md §6) : statut explicite + ligne scrape_log,
  // 500 si primary ET les 6 fallbacks n'ont rien donné (avant : 200 {ok:true}
  // avec lineups_fetched:0, et last_scraped_at rafraîchi quand même).
  const status =
    aggregateResult.lineups.length === 0 ? 'error' : aggregateResult.primaryOk ? 'ok' : 'partial'

  // last_scraped_at = dernier run ayant réellement récolté des lineups.
  if (status !== 'error') {
    await supabase
      .from('sources')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('id', source.id)
  }

  const summary = {
    primary_ok: aggregateResult.primaryOk,
    fallbacks_used: aggregateResult.fallbacksUsed,
    errors: aggregateResult.errors,
    lineups_fetched: aggregateResult.lineups.length,
    matched_total: matchedTotal,
    created,
    unmatched_count: unmatched.length,
    unmatched_sample: unmatched.slice(0, 20),
    by_show: byShow,
  }

  await logScrapeRun(supabase, {
    source: 'music_shows',
    status,
    startedAt,
    errorMsg:
      status === 'error'
        ? `0 lineups (primary + fallbacks KO): ${aggregateResult.errors
            .map((e) => `${e.source}: ${e.error}`)
            .join(' ; ')}`
        : status === 'partial'
          ? `primary KO, fallbacks used: ${[...new Set(aggregateResult.fallbacksUsed.map((f) => f.source))].join(', ')}`
          : null,
    details: summary,
  })

  if (status === 'error') {
    return NextResponse.json({ ok: false, ...summary }, { status: 500 })
  }
  return NextResponse.json({ ok: true, status, ...summary })
}
