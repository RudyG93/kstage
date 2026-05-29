import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  fetchAllLineups,
  SHOWS,
  SOURCE_URL,
  type ShowId,
} from '@/lib/scrapers/music-shows/live-show-updates'
import { extractCanonicalName } from '@/lib/scrapers/music-shows/canonical'

// Vercel Cron déclenche en GET et ajoute l'en-tête Authorization: Bearer ${CRON_SECRET}.
// Cf. /api/cron/scrape-comebacks/route.ts pour le pattern.

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Aliases DB ↔ noms scrappés non couverts par la normalisation simple.
// Aligné avec src/lib/scrapers/kpopofficial.ts:80.
const GROUP_ALIASES: Record<string, string> = {
  gidle: 'idle', // "(G)I-DLE" → slug `idle`
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
  SHOWS.map((s) => [s.id, s.displayName]),
) as Record<ShowId, string>

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
  if (!source)
    return NextResponse.json({ error: 'live-show-updates source not seeded' }, { status: 500 })

  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id, slug, name')
  if (groupsError) return NextResponse.json({ error: groupsError.message }, { status: 500 })
  const groupRefs: GroupRef[] = (groups ?? []).map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
  }))

  let lineups
  try {
    lineups = await fetchAllLineups()
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }

  let created = 0
  let matchedTotal = 0
  const unmatched: string[] = []
  const byShow: Record<string, { matched: number; created: number; skipped: number }> = {}

  for (const lineup of lineups) {
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
        start_at: lineup.startAtIso,
        // Highlight broadcast Show Champion = rediffusion → tentative.
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

  await supabase
    .from('sources')
    .update({ last_scraped_at: new Date().toISOString() })
    .eq('id', source.id)

  return NextResponse.json({
    ok: true,
    lineups_fetched: lineups.length,
    matched_total: matchedTotal,
    created,
    unmatched_count: unmatched.length,
    unmatched_sample: unmatched.slice(0, 20),
    by_show: byShow,
  })
}
