import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { scrapeComebacks } from '@/lib/scrapers/kpopofficial'
import { scrapeWikipediaReleases } from '@/lib/scrapers/wikipedia-releases'
import { ingestDebuts } from '@/lib/scrapers/debuts/ingest'
import { refreshRecentRosters } from '@/lib/scrapers/debuts/roster-watch'
import { logScrapeRun } from '@/lib/scrapers/scrape-log'

// Vercel Cron déclenche en GET et ajoute l'en-tête Authorization: Bearer ${CRON_SECRET}.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id, slug, name')
  if (groupsError) return NextResponse.json({ error: groupsError.message }, { status: 500 })
  const groupList = groups ?? []

  // --- Source primaire : kpopofficial (porte la majorité du futur) ---
  const { data: kpopSource, error: kpopErr } = await supabase
    .from('sources')
    .select('id')
    .eq('type', 'kpopofficial')
    .maybeSingle()
  if (kpopErr) return NextResponse.json({ error: kpopErr.message }, { status: 500 })
  if (!kpopSource)
    return NextResponse.json({ error: 'kpopofficial source not seeded' }, { status: 500 })

  // P0.3 observabilité : statut explicite + ligne scrape_log par source.
  let primaryStatus: 'ok' | 'partial' | 'error' = 'error'
  let kpopResult: unknown
  const startedKpop = new Date().toISOString()
  try {
    const result = await scrapeComebacks(kpopSource, groupList, supabase)
    kpopResult = result
    primaryStatus = result.pagesFetched === 0 ? 'error' : result.parsed === 0 ? 'partial' : 'ok'
    await logScrapeRun(supabase, {
      source: 'kpopofficial',
      status: primaryStatus,
      startedAt: startedKpop,
      errorMsg:
        primaryStatus === 'error'
          ? `0/${result.pagesTried} pages fetched: ${result.fetchErrors.join(' ; ')}`
          : primaryStatus === 'partial'
            ? 'pages fetched but 0 entries parsed — markup change?'
            : null,
      details: { ...result },
    })
  } catch (err) {
    kpopResult = { error: String(err) }
    await logScrapeRun(supabase, {
      source: 'kpopofficial',
      status: 'error',
      startedAt: startedKpop,
      errorMsg: String(err),
    })
  }

  // --- Source secondaire : Wikipedia (P0.7, casse le SPOF) — optionnelle ---
  // Tant qu'elle n'est pas seedée, on saute sans bruit. Son échec n'invalide pas
  // le run (la primaire porte le gros) mais reste tracé dans scrape_log.
  const { data: wikiSource } = await supabase
    .from('sources')
    .select('id')
    .eq('type', 'wikipedia')
    .maybeSingle()

  let wikiResult: unknown = null
  if (wikiSource) {
    const startedWiki = new Date().toISOString()
    try {
      const result = await scrapeWikipediaReleases(wikiSource, groupList, supabase)
      wikiResult = result
      const wikiStatus =
        result.pagesFetched === 0 ? 'error' : result.parsed === 0 ? 'partial' : 'ok'
      await logScrapeRun(supabase, {
        source: 'wikipedia',
        status: wikiStatus,
        startedAt: startedWiki,
        errorMsg:
          wikiStatus === 'error'
            ? result.fetchErrors.join(' ; ')
            : wikiStatus === 'partial'
              ? 'wikitext fetched but 0 entries parsed — markup change?'
              : null,
        details: { ...result },
      })
    } catch (err) {
      wikiResult = { error: String(err) }
      await logScrapeRun(supabase, {
        source: 'wikipedia',
        status: 'error',
        startedAt: startedWiki,
        errorMsg: String(err),
      })
    }
  }

  // --- Étage 3 : auto-découverte des debuts (R4-I) — optionnel, best-effort.
  // Détecte les nouveaux groupes sur kpop.fandom, auto-crée ceux qui passent
  // le gate (date concrète + notabilité), met le reste en revue /admin/debuts.
  let debutResult: unknown = null
  {
    const startedDebuts = new Date().toISOString()
    try {
      const result = await ingestDebuts(supabase, { youtubeKey: process.env.YOUTUBE_API_KEY })
      debutResult = result
      await logScrapeRun(supabase, {
        source: 'fandom_debuts',
        status: result.blocked ? 'partial' : result.errors.length > 0 ? 'partial' : 'ok',
        startedAt: startedDebuts,
        errorMsg: result.blocked
          ? 'fandom api.php 403 — re-router (GitHub Actions ?) si persistant'
          : result.errors.length > 0
            ? result.errors.slice(0, 3).join(' ; ')
            : null,
        details: { ...result },
      })
    } catch (err) {
      debutResult = { error: String(err) }
      await logScrapeRun(supabase, {
        source: 'fandom_debuts',
        status: 'error',
        startedAt: startedDebuts,
        errorMsg: String(err),
      })
    }
  }

  // --- Étage 4 : roster watch des (pre)debuts récents (round 2026-07-18) —
  // append-only, best-effort. Les reveals de membres post-création (cas
  // OURBIRTHDAY : 3ᵉ membre annoncé après coup) arrivent en base tout seuls.
  let rosterResult: unknown = null
  {
    const startedRoster = new Date().toISOString()
    try {
      const result = await refreshRecentRosters(supabase)
      rosterResult = result
      await logScrapeRun(supabase, {
        source: 'roster_watch',
        status: result.blocked || result.errors.length > 0 ? 'partial' : 'ok',
        startedAt: startedRoster,
        errorMsg: result.blocked
          ? 'fandom api.php 403'
          : result.errors.length > 0
            ? result.errors.slice(0, 3).join(' ; ')
            : null,
        details: { ...result },
      })
    } catch (err) {
      rosterResult = { error: String(err) }
      await logScrapeRun(supabase, {
        source: 'roster_watch',
        status: 'error',
        startedAt: startedRoster,
        errorMsg: String(err),
      })
    }
  }

  // Le cron échoue (500, visible dans Vercel Crons) uniquement si la primaire est
  // inexploitable. Wikipedia et les debuts sont des filets : leur état vit dans
  // scrape_log.
  if (primaryStatus === 'error') {
    return NextResponse.json({ ok: false, kpopResult, wikiResult, debutResult }, { status: 500 })
  }
  return NextResponse.json({
    ok: true,
    primaryStatus,
    kpopResult,
    wikiResult,
    debutResult,
    rosterResult,
  })
}
