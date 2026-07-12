// Backfill one-shot des MV YouTube pour des sources fraîchement seedées (P0.5)
// ou re-pagination profonde du catalogue existant (R4-A, SCRAPING.md §3.19).
// Paginera l'historique de la playlist uploads (1 unit / 50 vidéos — cf.
// SCRAPING.md §2) avec les mêmes gates que le cron quotidien.
//
// Usage :
//   npx tsx scripts/backfill-youtube.ts                    # toutes les sources
//   npx tsx scripts/backfill-youtube.ts --max-pages=0      # pleine profondeur
//   npx tsx scripts/backfill-youtube.ts --slugs=bts,twice  # groupes ciblés
//   npx tsx scripts/backfill-youtube.ts --budget=9000      # plafond quota (défaut)
//
// ⚠️ --new (sources jamais scrapées) matche 0 source dès que le cron quotidien
// est passé (il pose last_scraped_at partout) — réservé à l'onboarding d'une
// source seedée dans la journée. Un run « profond » doit tourner SANS --new.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import { scrapeGroup, QuotaExceededError, type UploadItem } from '../src/lib/scrapers/youtube'
import { logScrapeRun } from '../src/lib/scrapers/scrape-log'

function envLocal(key: string): string {
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`))
  if (!line) throw new Error(`${key} absent de .env.local`)
  return line
    .slice(key.length + 1)
    .replace(/^"|"$/g, '')
    .trim()
}

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

async function main() {
  const supabase = createClient<Database>(
    envLocal('NEXT_PUBLIC_SUPABASE_URL'),
    envLocal('SUPABASE_SERVICE_ROLE_KEY'),
  )
  const apiKey = envLocal('YOUTUBE_API_KEY')
  const rawMaxPages = Number(arg('max-pages') ?? '12')
  // 0 = illimité : la boucle de scrapeGroup s'arrête d'elle-même quand la
  // playlist n'a plus de nextPageToken (catalogue le plus profond mesuré :
  // Stone Music, 292 pages).
  const maxPages = rawMaxPages === 0 ? Number.MAX_SAFE_INTEGER : rawMaxPages
  // Plafond d'units du run : un 403 quota en plein milieu tronque la
  // couverture SILENCIEUSEMENT (piège §3.19 — le « deep run » fantôme du
  // 2026-07-12). On s'arrête proprement AVANT, avec la liste de reprise.
  const budget = Number(arg('budget') ?? '9000')
  const onlyNew = process.argv.includes('--new')
  const slugs = arg('slugs')?.split(',') ?? null
  const startedAt = new Date().toISOString()

  if (onlyNew && rawMaxPages !== 12) {
    console.warn(
      '⚠️  --new + pagination profonde : toutes les sources déjà passées au cron ont last_scraped_at → probablement 0 cible. Retire --new pour un run profond.',
    )
  }

  let query = supabase
    .from('sources')
    .select('id, name, url, group_id, last_scraped_at, groups(slug)')
    .eq('type', 'youtube_api')
    .not('group_id', 'is', null)
  if (onlyNew) query = query.is('last_scraped_at', null)
  const { data: sources, error } = await query
  if (error) throw error

  const targets = (sources ?? []).filter(
    (s) => !slugs || (s.groups && slugs.includes(s.groups.slug)),
  )
  console.log(
    `${targets.length} source(s) à backfiller (maxPages=${rawMaxPages === 0 ? '∞' : rawMaxPages}, budget=${budget} units)\n`,
  )

  // Cache des playlists uploads partagé entre sources du run : HYBE LABELS
  // est la source de 12 groupes, SMTOWN de 10 — sans cache on re-paie ~40 %
  // du quota à re-paginer les mêmes pages.
  const pageCache = new Map<string, UploadItem[]>()

  let totalUnits = 0
  let totalInserted = 0
  let failures = 0
  const remaining: string[] = []
  let aborted: 'quota' | 'budget' | null = null

  for (let i = 0; i < targets.length; i++) {
    const s = targets[i]
    if (totalUnits >= budget) {
      aborted = 'budget'
      remaining.push(...targets.slice(i).map((t) => t.groups?.slug ?? t.name))
      break
    }
    try {
      const r = await scrapeGroup(
        { id: s.id, url: s.url, group_id: s.group_id! },
        apiKey,
        supabase,
        { maxPages, pageCache },
      )
      totalUnits += r.units
      totalInserted += r.inserted
      console.log(
        `✔ ${s.name} — inserted=${r.inserted} skipped=${r.skipped} premieres=${r.premieres} units=${r.units}`,
      )
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        aborted = 'quota'
        remaining.push(...targets.slice(i).map((t) => t.groups?.slug ?? t.name))
        console.error(`✖ QUOTA ÉPUISÉ sur ${s.name} — arrêt propre.`)
        break
      }
      failures++
      console.error(`✖ ${s.name} — ${String(e)}`)
    }
  }

  if (remaining.length > 0) {
    const uniq = [...new Set(remaining)]
    console.error(
      `\n⛔ Arrêt (${aborted}) — ${uniq.length} groupe(s) NON couverts. Reprendre demain avec :\n` +
        `   npx tsx scripts/backfill-youtube.ts --max-pages=${rawMaxPages} --slugs=${uniq.join(',')}`,
    )
  }
  console.log(`\nTotal : ${totalInserted} MV insérés, ${totalUnits} units consommées.`)

  // Trace d'audit : les backfills manuels n'en laissaient aucune, rendant les
  // runs fantômes indiagnosticables (§3.19).
  await logScrapeRun(supabase, {
    source: 'youtube_backfill',
    status: aborted ? 'partial' : failures > 0 ? 'partial' : 'ok',
    startedAt,
    errorMsg: aborted ? `${aborted}: ${remaining.length} sources restantes` : null,
    details: {
      maxPages: rawMaxPages,
      budget,
      units: totalUnits,
      inserted: totalInserted,
      sources: targets.length,
      failures,
      remaining: [...new Set(remaining)].slice(0, 50),
    },
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
