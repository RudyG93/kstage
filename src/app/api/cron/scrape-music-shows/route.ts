import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { aggregateLineups } from '@/lib/scrapers/music-shows/aggregator'
import { SOURCE_URL } from '@/lib/scrapers/music-shows/sources/live-show-updates'
import { extractCanonicalName } from '@/lib/scrapers/music-shows/canonical'
import { enrichStageLinks } from '@/lib/scrapers/music-shows/stage-links'
import { SHOW_DESCRIPTORS, type ShowId } from '@/lib/scrapers/music-shows/types'
import { logScrapeRun } from '@/lib/scrapers/scrape-log'
// normalize partagé (Unicode-aware) : matche aussi les noms hangul des lineups —
// la copie locale ASCII-only les ratait (DRY, audit 2026-07-03).
import { normalize, withinOneEdit } from '@/lib/scrapers/group-match'
import { kstDayBounds } from '@/lib/events/date'

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
  // Tolérance typo (1 édition) pour les noms LONGS uniquement : le carrd a
  // écrit « Heart2Hearts » pour Hearts2Hearts (raté réel, M Countdown EP.936
  // du 2026-07-09 — le groupe a manqué l'épisode). Seuil 8 chars normalisés :
  // jamais de fuzzy sur les noms courts (izna/i-dle/aoa → collisions).
  if (key.length >= 8) {
    for (const g of groups) {
      const n = normalize(g.name)
      if (n.length >= 8 && withinOneEdit(key, n)) return g
    }
  }
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
  const byShow: Record<
    string,
    { matched: number; created: number; skipped: number; updated: number }
  > = {}

  let reconciled = 0
  for (const lineup of aggregateResult.lineups) {
    const showStats = (byShow[lineup.show] ??= { matched: 0, created: 0, skipped: 0, updated: 0 })
    const showLabel = SHOW_DISPLAY_NAME[lineup.show]
    const matchedIds: string[] = []

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
      matchedIds.push(group.id)

      // Idempotence par JOUR KST, plus par start_at exact (fix 2026-07-12) :
      // le carrd révise parfois l'heure d'un épisode (« 3:15pm » → « 3:20pm »
      // le 11/07) — l'égalité stricte créait alors une 2ᵉ row par groupe que
      // ni l'index unique ni la réconciliation (keyés start_at) ne voyaient.
      // Un show n'a jamais deux épisodes le même jour : la row du jour est LA
      // row de l'épisode → time-shift = UPDATE, surplus historique = purge.
      const { from: dayFrom, to: dayTo } = kstDayBounds(lineup.startAtIso)
      const { data: existingRows } = await supabase
        .from('events')
        .select('id, start_at')
        .eq('group_id', group.id)
        .eq('type', 'music_show')
        .eq('title', showLabel)
        .eq('source_url', SOURCE_URL)
        .gte('start_at', dayFrom)
        .lt('start_at', dayTo)
        .order('created_at', { ascending: true })
      const sameDay = existingRows ?? []
      const exact = sameDay.find(
        (r) => new Date(r.start_at).getTime() === Date.parse(lineup.startAtIso),
      )
      const surplus = sameDay.filter((r) => r !== (exact ?? sameDay[0]))

      if (surplus.length > 0) {
        // Self-heal : détacher les notifs envoyées puis supprimer les rows
        // à l'ancienne heure (le rappel est parti, l'épisode n'a qu'une heure).
        const ids = surplus.map((r) => r.id)
        await supabase.from('event_notifications').delete().in('event_id', ids)
        const { error: delErr } = await supabase.from('events').delete().in('id', ids)
        if (!delErr) reconciled += ids.length
      }

      if (exact) {
        showStats.skipped++
        continue
      }
      if (sameDay.length > 0) {
        // Time-shift : même épisode, nouvelle heure → update de la row du jour.
        const { error: updErr } = await supabase
          .from('events')
          .update({ start_at: lineup.startAtIso, episode_number: lineup.episodeNumber })
          .eq('id', sameDay[0].id)
        if (updErr) console.error(`music-shows time-shift update failed: ${updErr.message}`)
        else showStats.updated++
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

    // Réconciliation (2026-07-11) : le carrd révise ses lineups jusqu'au jour
    // J — 5 rows fantômes réelles sur Music Bank 10/07 (groupes retirés du
    // lineup final, jamais nettoyés, jamais stage-linkés). Pour un épisode
    // FUTUR fetché avec un lineup substantiel, on supprime les rows carrd des
    // groupes absents. Garde-fous : jamais sur le passé (l'histoire diffusée
    // ne se réécrit pas), jamais sur lineup maigre (< 3 entrées = édition
    // partielle en cours), et le fuzzy-match amont évite qu'une typo source
    // fasse passer un groupe présent pour absent.
    if (
      matchedIds.length > 0 &&
      lineup.artistsRaw.length >= 3 &&
      Date.parse(lineup.startAtIso) > Date.now()
    ) {
      // Fenêtre = jour KST (pas start_at exact) : un time-shift du carrd ne
      // doit pas soustraire les rows à l'ancienne heure à la réconciliation.
      const { from: dayFrom, to: dayTo } = kstDayBounds(lineup.startAtIso)
      const { data: stale } = await supabase
        .from('events')
        .select('id')
        .eq('type', 'music_show')
        .eq('source_url', SOURCE_URL)
        .eq('title', showLabel)
        .gte('start_at', dayFrom)
        .lt('start_at', dayTo)
        .not('group_id', 'in', `(${matchedIds.join(',')})`)
      if (stale && stale.length > 0) {
        const staleIds = stale.map((s) => s.id)
        // Les notifications déjà envoyées référencent l'event (FK) : on les
        // détache d'abord — le rappel est parti, l'event n'a plus lieu.
        await supabase.from('event_notifications').delete().in('event_id', staleIds)
        const { error: delErr } = await supabase.from('events').delete().in('id', staleIds)
        if (!delErr) reconciled += staleIds.length
        else console.error(`music-shows reconcile failed: ${delErr.message}`)
      }
    }
  }

  // Phase 2 — stage links (2026-07-03) : remplace le source_url carrd des
  // events diffusés récemment par la vidéo YouTube du passage (chaînes des
  // diffuseurs vérifiées). Best-effort : un échec ne bloque pas l'ingestion.
  let stageLinks: Awaited<ReturnType<typeof enrichStageLinks>> | { error: string } = {
    error: 'YOUTUBE_API_KEY missing',
  }
  const ytKey = process.env.YOUTUBE_API_KEY
  if (ytKey) {
    try {
      stageLinks = await enrichStageLinks(supabase, ytKey)
    } catch (e) {
      stageLinks = { error: e instanceof Error ? e.message : String(e) }
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
    reconciled,
    unmatched_count: unmatched.length,
    // Échantillon PAR SHOW (8 max chacun) : le cap global de 20 masquait les
    // unmatched des derniers shows (le raté Heart2Hearts était invisible).
    unmatched_sample: Object.values(
      unmatched.reduce<Record<string, string[]>>((acc, u) => {
        const show = u.split('/', 1)[0]
        ;(acc[show] ??= []).push(u)
        return acc
      }, {}),
    ).flatMap((list) => list.slice(0, 8)),
    by_show: byShow,
    stage_links: stageLinks,
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
