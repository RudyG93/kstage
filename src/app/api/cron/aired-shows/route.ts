import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { scanAiredShows } from '@/lib/scrapers/music-shows/aired-lineups'
import { applyEpisodeAuthority } from '@/lib/scrapers/music-shows/episode-authority'
import { logScrapeRun } from '@/lib/scrapers/scrape-log'
import type { Database } from '@/types/database'

// Réconciliation post-diffusion des music shows (round 2026-08-21).
//
// Séparé de `scrape-music-shows` à dessein : celui-ci lit des lineups
// PRÉVISIONNELS sur des sites tiers et reste plafonné à 2 passages/jour
// (règle de politesse scraping). Ici on n'interroge que l'API YouTube
// officielle et l'API Wikipedia — donc plusieurs passages par jour sont
// légitimes, et c'est justement ce qu'il faut : les scènes sont publiées
// dans les heures qui suivent la diffusion, et Rudy voyait les passages
// arriver « trop tard » sur les pages artistes.
export const maxDuration = 300

/** Fenêtre de rattrapage par défaut : couvre 4 semaines de diffusions. */
const DEFAULT_SINCE_DAYS = 28
const DEFAULT_PAGES = 5

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'YOUTUBE_API_KEY missing' }, { status: 500 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const url = new URL(req.url)
  const pages = Number(url.searchParams.get('pages')) || DEFAULT_PAGES
  const since =
    url.searchParams.get('since') ??
    new Date(Date.now() + 9 * 3600_000 - DEFAULT_SINCE_DAYS * 86_400_000).toISOString().slice(0, 10)

  const startedAt = new Date().toISOString()
  let scan: Awaited<ReturnType<typeof scanAiredShows>> | null = null
  let scanError: string | null = null
  try {
    scan = await scanAiredShows(supabase, apiKey, { maxPages: pages, sinceKstDay: since })
  } catch (e) {
    scanError = e instanceof Error ? e.message : String(e)
  }

  // Autorité de numérotation : Mnet et Show Champion annoncent « EP.942 » dans
  // le titre de leurs vidéos (déjà lu ci-dessus) ; les quatre autres shows
  // n'ont que Wikipedia. Quelques requêtes API par run, jamais du scraping.
  let authority: Awaited<ReturnType<typeof applyEpisodeAuthority>> | { error: string }
  try {
    authority = await applyEpisodeAuthority(supabase, { sinceKstDay: since })
  } catch (e) {
    authority = { error: e instanceof Error ? e.message : String(e) }
  }

  const status = scanError ? 'error' : scan && scan.errors.length > 0 ? 'partial' : 'ok'
  const summary = {
    since,
    pages,
    units: scan?.units ?? 0,
    episodes_created: scan?.episodesCreated ?? 0,
    numbers_filled: scan?.numbersFilled ?? 0,
    numbers_synced: scan?.numbersSynced ?? 0,
    events_created: scan?.eventsCreated ?? 0,
    stages_linked: scan?.stagesLinked ?? 0,
    by_show: scan?.byShow ?? {},
    // Passages annoncés qu'aucune vidéo du diffuseur ne confirme : soit un
    // lineup prévisionnel qui ne s'est pas réalisé, soit un alias manquant
    // (« TXT » vs « TOMORROW X TOGETHER »). Revue humaine, jamais de purge auto.
    unconfirmed: scan?.unconfirmed.slice(0, 40) ?? [],
    unconfirmed_count: scan?.unconfirmed.length ?? 0,
    created_sample: scan?.created.slice(0, 30) ?? [],
    authority,
    errors: scan?.errors ?? [],
  }

  await logScrapeRun(supabase, {
    source: 'aired_shows',
    status,
    startedAt,
    errorMsg: scanError ?? (scan?.errors.length ? scan.errors.join(' ; ') : null),
    details: summary,
  })

  if (status === 'error') return NextResponse.json({ ok: false, ...summary }, { status: 500 })
  return NextResponse.json({ ok: true, status, ...summary })
}
