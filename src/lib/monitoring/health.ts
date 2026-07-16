// Monitoring actif du scraping (Phase 1 Lot 5, audit §6.3) — logique pure et
// testable (aucun I/O). Le cron /api/cron/monitor fournit les rows scrape_log
// récentes ; on évalue le contrat d'alerte :
//   1. deux runs consécutifs non-`ok` d'une même source → alerte qualifiée ;
//   2. music show à J-1 sans données (details.stale_alerts du dernier run,
//      calculé par le scraper — on le PROMEUT en alerte, pas de ré-implémentation) ;
//   3. source critique sans run `ok` depuis 2 × sa cadence attendue (ou jamais
//      loguée) → alerte — couvre aussi le cron mort et l'échec silencieux de
//      logScrapeRun ;
//   4. l'échec du monitor lui-même (lecture scrape_log impossible) est géré par
//      la route (500 → run GitHub Actions rouge → email natif).
// Statut nominal = 'ok' (le code n'écrit JAMAIS 'success' — le commentaire SQL
// de la migration 0017 est périmé sur ce point).
// Anti-spam : aucune dédup — 1 run/jour ⇒ au plus 1 email/jour par problème
// persistant ; une dédup exigerait un état persistant pour rien.

export type ScrapeLogRow = {
  source: string
  status: string
  started_at: string
  details: unknown
}

export type SourceSpec = {
  source: string // valeur écrite dans scrape_log.source
  label: string
  cadenceHours: number // cadence attendue (crons.yml)
  critical: boolean // périmé 2 cycles → alerte (sinon seule la règle 1 s'applique)
}

export const MONITORED_SOURCES: readonly SourceSpec[] = [
  { source: 'music_shows', label: 'Music shows', cadenceHours: 12, critical: true },
  { source: 'kpopofficial', label: 'Comebacks (kpopofficial)', cadenceHours: 24, critical: true },
  { source: 'youtube', label: 'YouTube MVs', cadenceHours: 24, critical: true },
  { source: 'wikipedia', label: 'Comebacks (Wikipedia)', cadenceHours: 24, critical: false },
  { source: 'fandom_debuts', label: 'Debuts (fandom)', cadenceHours: 24, critical: false },
  { source: 'refresh_images', label: 'Images', cadenceHours: 24, critical: false },
  { source: 'notify_comebacks', label: 'Push comebacks', cadenceHours: 24, critical: true },
  { source: 'send_digest', label: 'Push digest', cadenceHours: 24, critical: true },
  // Hebdo (lundi) — non critique : un lundi raté se rattrape la semaine
  // suivante, la règle « périmé 2 cycles » ne s'applique qu'aux critiques.
  { source: 'channel_discovery', label: 'Channel discovery', cadenceHours: 168, critical: false },
]

export type SourceCheck = {
  source: string
  label: string
  lastRunAt: string | null
  lastStatus: string | null
  lastOkAt: string | null
  alerts: string[]
}

/** `details.stale_alerts` du dernier run music_shows, parse défensif (jsonb). */
function staleAlertsOf(row: ScrapeLogRow | undefined): string[] {
  if (!row || typeof row.details !== 'object' || row.details === null) return []
  const raw = (row.details as Record<string, unknown>).stale_alerts
  if (!Array.isArray(raw)) return []
  return raw.map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
}

export function evaluateSourceHealth(
  rows: readonly ScrapeLogRow[],
  now: Date,
  specs: readonly SourceSpec[] = MONITORED_SOURCES,
): { checks: SourceCheck[]; alerts: string[] } {
  // Rows par source, du plus récent au plus ancien.
  const bySource = new Map<string, ScrapeLogRow[]>()
  for (const row of rows) {
    const list = bySource.get(row.source) ?? []
    list.push(row)
    bySource.set(row.source, list)
  }
  for (const list of bySource.values()) {
    list.sort((a, b) => b.started_at.localeCompare(a.started_at))
  }

  const checks: SourceCheck[] = []
  for (const spec of specs) {
    const runs = bySource.get(spec.source) ?? []
    const last = runs[0]
    const lastOk = runs.find((r) => r.status === 'ok')
    const alerts: string[] = []

    // Règle 1 — deux runs consécutifs non-ok.
    if (runs.length >= 2 && runs[0].status !== 'ok' && runs[1].status !== 'ok') {
      alerts.push(`${spec.label}: 2 runs consécutifs en ${runs[0].status}/${runs[1].status}`)
    }

    // Règle 2 — music show à J-1 sans données (promue depuis le scraper).
    if (spec.source === 'music_shows') {
      for (const stale of staleAlertsOf(last)) {
        alerts.push(`Music show J-1 sans données: ${stale}`)
      }
    }

    // Règle 3 — source critique périmée : pas de run ok depuis 2 × cadence
    // (ou jamais loguée). Couvre le cron mort et le logging silencieusement cassé.
    if (spec.critical) {
      const staleMs = 2 * spec.cadenceHours * 60 * 60 * 1000
      const lastOkMs = lastOk ? Date.parse(lastOk.started_at) : null
      if (lastOkMs === null || now.getTime() - lastOkMs > staleMs) {
        const age =
          lastOkMs === null ? 'jamais' : `${Math.round((now.getTime() - lastOkMs) / 3_600_000)} h`
        alerts.push(`${spec.label}: aucun run ok depuis ${age} (cadence ${spec.cadenceHours} h)`)
      }
    }

    checks.push({
      source: spec.source,
      label: spec.label,
      lastRunAt: last?.started_at ?? null,
      lastStatus: last?.status ?? null,
      lastOkAt: lastOk?.started_at ?? null,
      alerts,
    })
  }

  return { checks, alerts: checks.flatMap((c) => c.alerts) }
}
