import type { Route } from 'next'
import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth/require-admin'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { runDataHealthChecks } from '@/lib/health/checks'
import { REMEDIES } from '@/lib/health/remedies'
import { RemedyButton } from '@/components/admin/remedy-button'
import type { Database } from '@/types/database'

export const metadata = { title: 'Data health' }

// Tableau de bord des classes d'erreur data connues (round 2026-07-18) : chaque
// problème déjà rencontré (photos, MVs maigres, stages, numérotation, doublons
// de personnes…) est un check qui remonte tout seul — burn-down visible, plus
// de redécouverte surface par surface.
export default async function AdminHealthPage() {
  await requireAdminPage()

  // Les checks lisent des tables sans policy publique (lineup_unmatched,
  // scrape_log) + Storage → service role, APRÈS la garde admin.
  const service = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const report = await runDataHealthChecks(service)
  const warns = report.checks.filter((c) => c.severity === 'warn')
  const infos = report.checks.filter((c) => c.severity === 'info')
  const totalIssues = warns.reduce((a, c) => a + c.count, 0)

  // Derniers runs de crons (retour Rudy 2026-08-20 : les boutons 1-CLIC
  // renvoyaient vers scrape_log… qui n'était visible nulle part). C'est ICI
  // que le résultat d'un déclenchement se lit.
  const { data: runs } = await service
    .from('scrape_log')
    .select('id, source, status, started_at, ended_at, error_msg, details')
    .order('started_at', { ascending: false })
    .limit(10)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Data health</h1>
          <p className="text-muted-foreground text-sm">
            {totalIssues} problème(s) sur {warns.length} checks · généré{' '}
            {report.generatedAt.slice(0, 16).replace('T', ' ')} UTC
          </p>
        </div>

        {/* Résultat des crons — dont ceux déclenchés par les boutons 1-CLIC
            ci-dessous (rafraîchir la page ~1-2 min après un clic). */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Derniers runs de crons</h2>
          <ul className="divide-y rounded-md border">
            {(runs ?? []).map((run) => {
              const durS = run.ended_at
                ? Math.round((Date.parse(run.ended_at) - Date.parse(run.started_at)) / 1000)
                : null
              return (
                <li key={run.id} className="px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        run.status === 'ok'
                          ? 'font-semibold text-teal-600 dark:text-teal-400'
                          : run.status === 'partial'
                            ? 'font-semibold text-amber-600 dark:text-amber-400'
                            : 'font-semibold text-red-500'
                      }
                    >
                      {run.status}
                    </span>
                    <span className="font-mono font-medium">{run.source}</span>
                    <span className="text-muted-foreground">
                      {run.started_at.slice(0, 16).replace('T', ' ')} UTC
                      {durS !== null ? ` · ${durS}s` : ''}
                    </span>
                  </div>
                  {run.error_msg && (
                    <p className="text-muted-foreground mt-1 truncate" title={run.error_msg}>
                      {run.error_msg}
                    </p>
                  )}
                  {run.details != null && (
                    <details className="mt-1">
                      <summary className="text-muted-foreground cursor-pointer select-none">
                        details
                      </summary>
                      <pre className="bg-secondary/50 mt-1 max-h-64 overflow-auto rounded p-2 text-[10px] break-all whitespace-pre-wrap">
                        {JSON.stringify(run.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        {[...warns, ...infos].map((check) => {
          const remedy = REMEDIES[check.id]
          return (
            <section key={check.id} className="space-y-2">
              <h2 className="flex items-baseline gap-2 text-sm font-semibold">
                <span
                  className={
                    check.count === 0
                      ? 'text-muted-foreground'
                      : check.severity === 'warn'
                        ? 'text-amber-500'
                        : 'text-muted-foreground'
                  }
                >
                  {check.count === 0 ? '✓' : check.count}
                </span>
                {check.label}
              </h2>
              {/* Remède (Lot 5 peaufinage 2026-08-20) : chaque problème dit
                  comment il se résout — AUTO / 1-clic / revue humaine. */}
              {check.count > 0 && remedy && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={
                      remedy.kind === 'auto'
                        ? 'rounded-[4px] bg-teal-500/10 px-1.5 py-0.5 font-semibold text-teal-600 dark:text-teal-400'
                        : remedy.kind === 'one_click'
                          ? 'text-primary bg-primary/10 rounded-[4px] px-1.5 py-0.5 font-semibold'
                          : 'rounded-[4px] bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-600 dark:text-amber-400'
                    }
                  >
                    {remedy.kind === 'auto'
                      ? 'AUTO'
                      : remedy.kind === 'one_click'
                        ? '1-CLIC'
                        : 'REVUE'}
                  </span>
                  <span className="text-muted-foreground">{remedy.note}</span>
                  {remedy.kind === 'one_click' && (
                    <RemedyButton cron={remedy.cron} label={remedy.buttonLabel} />
                  )}
                  {remedy.kind === 'review' && remedy.href && (
                    <Link
                      href={remedy.href as Route}
                      className="text-primary font-semibold hover:underline"
                    >
                      {remedy.linkLabel ?? 'Ouvrir'} →
                    </Link>
                  )}
                </div>
              )}
              {check.count > 0 && check.sample.length > 0 && (
                <ul className="text-muted-foreground space-y-1 rounded-md border p-3 font-mono text-xs">
                  {check.sample.map((line) => (
                    <li key={line} className="truncate" title={line}>
                      {line}
                    </li>
                  ))}
                  {check.count > check.sample.length && (
                    <li className="italic">… +{check.count - check.sample.length} autres</li>
                  )}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
