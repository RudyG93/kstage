import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  aggregateLineups,
  PRIMARY_SOURCE,
  FALLBACK_SOURCES,
} from '@/lib/scrapers/music-shows/aggregator'
import { SOURCE_URL } from '@/lib/scrapers/music-shows/sources/live-show-updates'
import { extractCanonicalName } from '@/lib/scrapers/music-shows/canonical'
import {
  collectUnmatched,
  persistUnmatched,
  type UnmatchedCollector,
} from '@/lib/scrapers/music-shows/unmatched'
import { enrichStageLinks } from '@/lib/scrapers/music-shows/stage-links'
import {
  SHOW_DESCRIPTORS,
  type ShowDescriptor,
  type ShowId,
} from '@/lib/scrapers/music-shows/types'
import { logScrapeRun } from '@/lib/scrapers/scrape-log'
// normalize partagé (Unicode-aware) : matche aussi les noms hangul des lineups —
// la copie locale ASCII-only les ratait (DRY, audit 2026-07-03).
import { normalize, withinOneEdit } from '@/lib/scrapers/group-match'
import { kstDayBounds, kstDayKey } from '@/lib/events/date'

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

// Prochaine occurrence UTC du slot hebdo KST d'un show (fenêtre 8 jours =
// couvre tout weekday, y compris « aujourd'hui plus tard dans la journée »).
function nextSlotUtcIso(desc: ShowDescriptor, nowMs: number): string {
  const kstNow = new Date(nowMs + 9 * 3600_000)
  for (let d = 0; d < 8; d++) {
    const kst = new Date(
      Date.UTC(
        kstNow.getUTCFullYear(),
        kstNow.getUTCMonth(),
        kstNow.getUTCDate() + d,
        desc.slot.hour,
        desc.slot.minute,
      ),
    )
    if (kst.getUTCDay() !== desc.slot.weekday) continue
    const utcMs = kst.getTime() - 9 * 3600_000
    if (utcMs >= nowMs) return new Date(utcMs).toISOString()
  }
  return new Date(nowMs).toISOString()
}

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

  // Provenance exacte des fallbacks (Phase 3 Lot 4) : events.source_id pointe
  // le provider RÉEL du lineup (rows broadcasters versionnées en 0058), plus
  // toujours la row carrd. Mapping label → row via SourceScraper.sourceUrl ;
  // row absente → repli carrd (jamais bloquant).
  const { data: showSources } = await supabase
    .from('sources')
    .select('id, url')
    .eq('type', 'music_shows')
    .is('group_id', null)
  const sourceIdByUrl = new Map((showSources ?? []).map((s) => [s.url, s.id]))
  const sourceIdByLabel = new Map<string, string>()
  for (const scraper of [PRIMARY_SOURCE, ...FALLBACK_SOURCES]) {
    const id = sourceIdByUrl.get(scraper.sourceUrl)
    if (id) sourceIdByLabel.set(scraper.label, id)
  }

  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id, slug, name')
  if (groupsError) return NextResponse.json({ error: groupsError.message }, { status: 500 })
  const groupRefs: GroupRef[] = (groups ?? []).map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
  }))
  const groupById = new Map(groupRefs.map((g) => [g.id, g]))

  // Solos de membres (R4-D) : « KIHYUN (MONSTA X) », « YEONJUN »… étaient
  // silencieusement unmatched alors que leur groupe est en base — en semaine
  // creuse il ne restait presque rien à afficher. Un stage_name ACTIF et sans
  // homonyme inter-groupes mappe vers son groupe (null = ambigu, on s'abstient).
  const { data: memberRows } = await supabase
    .from('members')
    .select('stage_name, group_id, status')
    .eq('status', 'active')
  const memberGroupByName = new Map<string, string | null>()
  for (const m of memberRows ?? []) {
    const key = normalize(m.stage_name)
    if (!key) continue
    const cur = memberGroupByName.get(key)
    memberGroupByName.set(key, cur === undefined || cur === m.group_id ? m.group_id : null)
  }

  const startedAt = new Date().toISOString()
  const aggregateResult = await aggregateLineups()

  let created = 0
  let matchedTotal = 0
  const unmatched: string[] = []
  const unmatchedCollector: UnmatchedCollector = new Map()
  const byShow: Record<
    string,
    { matched: number; created: number; skipped: number; updated: number }
  > = {}

  let reconciled = 0
  for (const lineup of aggregateResult.lineups) {
    const showStats = (byShow[lineup.show] ??= { matched: 0, created: 0, skipped: 0, updated: 0 })
    const showLabel = SHOW_DISPLAY_NAME[lineup.show]
    const matchedIds: string[] = []

    // Entité épisode (Lot N 2026-07-17) : une row stable par (show, jour KST)
    // — ancre des pages /show/[show]/[day] et de leurs commentaires. Upsert
    // best-effort : le time-shift met start_at à jour, episode_number n'est
    // écrit que quand la source le fournit (ne pas écraser par null).
    try {
      await supabase.from('show_episodes').upsert(
        {
          show_title: showLabel,
          kst_day: kstDayKey(lineup.startAtIso),
          start_at: lineup.startAtIso,
          ...(lineup.episodeNumber != null ? { episode_number: lineup.episodeNumber } : {}),
        },
        { onConflict: 'show_title,kst_day' },
      )
    } catch {
      // Table absente / erreur réseau : l'épisode ré-upsertera au prochain run.
    }

    for (const artistRaw of lineup.artistsRaw) {
      const canonical = extractCanonicalName(artistRaw)
      if (!canonical) continue
      let group = matchGroup(canonical, groupRefs)
      if (!group) {
        // « MEMBRE (GROUPE) » : l'intérieur des parens porte le groupe.
        const inner = /\(([^)]+)\)\s*$/.exec(canonical)?.[1]
        if (inner) group = matchGroup(inner, groupRefs)
      }
      if (!group) {
        // Solo d'un membre sans mention du groupe (YEONJUN → TXT).
        const bare = normalize(canonical.replace(/\s*\([^)]*\)\s*$/, ''))
        const viaMember = memberGroupByName.get(bare)
        if (viaMember) group = groupById.get(viaMember) ?? null
      }
      if (!group) {
        unmatched.push(`${lineup.show}/${canonical}`)
        // File « artistes hors-app » (retour Rudy 2026-07-17) : persistés avec
        // compteur de récurrence pour la revue admin — le log seul les perdait.
        collectUnmatched(unmatchedCollector, canonical, lineup.show)
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
        // Time-shift : même épisode, nouvelle heure → update de la row du jour
        // (+ provenance : le provider du lineup révisé peut différer).
        const { error: updErr } = await supabase
          .from('events')
          .update({
            start_at: lineup.startAtIso,
            episode_number: lineup.episodeNumber,
            source_id: sourceIdByLabel.get(lineup.sourceLabel) ?? source.id,
          })
          .eq('id', sameDay[0].id)
        if (updErr) console.error(`music-shows time-shift update failed: ${updErr.message}`)
        else showStats.updated++
        continue
      }

      const { error: insertErr } = await supabase.from('events').insert({
        group_id: group.id,
        // source_id = provenance RÉELLE ; source_url RESTE l'URL carrd (clé
        // d'idempotence unique(group,type,start,source_url) + clés de la
        // réconciliation — leçon 0040 : ne jamais toucher une clé d'unicité).
        source_id: sourceIdByLabel.get(lineup.sourceLabel) ?? source.id,
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

  // Alerte J-1 (R4-D) : un show qui diffuse dans < 36 h doit avoir soit un
  // lineup fetché ce run, soit une row en base pour ce jour KST. Sinon la
  // chaîne source de CE show est périmée — signal qui manquait quand le carrd
  // a servi « inkigayo matched:0 » 4 jours de suite avec un status global ok.
  const fetchedShows = new Set(aggregateResult.lineups.map((l) => l.show))
  const staleAlerts: string[] = []
  for (const desc of SHOW_DESCRIPTORS) {
    const slotIso = nextSlotUtcIso(desc, Date.now())
    if (Date.parse(slotIso) - Date.now() > 36 * 60 * 60 * 1000) continue
    if (fetchedShows.has(desc.id)) continue
    const { from: dayFrom, to: dayTo } = kstDayBounds(slotIso)
    const { count } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'music_show')
      .eq('title', desc.displayName)
      .gte('start_at', dayFrom)
      .lt('start_at', dayTo)
    if (!count) staleAlerts.push(desc.displayName)
  }

  // P0.3 observabilité (SCRAPING.md §6) : statut explicite + ligne scrape_log,
  // 500 si primary ET les 6 fallbacks n'ont rien donné (avant : 200 {ok:true}
  // avec lineups_fetched:0, et last_scraped_at rafraîchi quand même).
  const status =
    aggregateResult.lineups.length === 0
      ? 'error'
      : aggregateResult.primaryOk && staleAlerts.length === 0
        ? 'ok'
        : 'partial'

  // last_scraped_at = dernier run ayant réellement récolté des lineups.
  if (status !== 'error') {
    await supabase
      .from('sources')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('id', source.id)
  }

  // Persistance best-effort de la file hors-app — une table absente ou une
  // erreur réseau ne doit jamais faire échouer le scrape lui-même.
  const unmatchedPersist = await persistUnmatched(supabase, unmatchedCollector)

  const summary = {
    primary_ok: aggregateResult.primaryOk,
    fallbacks_used: aggregateResult.fallbacksUsed,
    errors: aggregateResult.errors,
    lineups_fetched: aggregateResult.lineups.length,
    matched_total: matchedTotal,
    created,
    reconciled,
    unmatched_count: unmatched.length,
    unmatched_persisted: unmatchedPersist.upserted,
    ...(unmatchedPersist.error ? { unmatched_persist_error: unmatchedPersist.error } : {}),
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
    stale_alerts: staleAlerts,
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
          ? [
              staleAlerts.length > 0 ? `J-1 sans lineup: ${staleAlerts.join(', ')}` : null,
              !aggregateResult.primaryOk
                ? `primary KO, fallbacks used: ${[...new Set(aggregateResult.fallbacksUsed.map((f) => f.source))].join(', ')}`
                : null,
            ]
              .filter(Boolean)
              .join(' ; ')
          : null,
    details: summary,
  })

  if (status === 'error') {
    return NextResponse.json({ ok: false, ...summary }, { status: 500 })
  }
  return NextResponse.json({ ok: true, status, ...summary })
}
