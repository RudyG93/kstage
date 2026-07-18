import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { runDataHealthChecks } from '@/lib/health/checks'
import type { Database } from '@/types/database'

export const metadata = { title: 'Data health' }

// Tableau de bord des classes d'erreur data connues (round 2026-07-18) : chaque
// problème déjà rencontré (photos, MVs maigres, stages, numérotation, doublons
// de personnes…) est un check qui remonte tout seul — burn-down visible, plus
// de redécouverte surface par surface.
export default async function AdminHealthPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdmin(user.email)) redirect('/')

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

        {[...warns, ...infos].map((check) => (
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
        ))}
      </div>
    </div>
  )
}
