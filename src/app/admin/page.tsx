import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { getSourceHealth } from '@/lib/monitoring/queries'
import { getActivationStats } from '@/lib/analytics/admin'
import { relativeTime } from '@/lib/events/date'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Admin' }

const SECTIONS = [
  {
    href: '/admin/images',
    title: 'Images',
    desc: 'Photo d’un membre par URL (self-host + aperçu).',
  },
  { href: '/admin/events', title: 'Events', desc: 'Corriger un titre MV, masquer un faux event.' },
  { href: '/admin/banners', title: 'Banners', desc: 'Recadrer le bandeau d’un groupe.' },
  { href: '/admin/debuts', title: 'Debuts', desc: 'File de revue des débuts détectés.' },
  {
    href: '/admin/suggestions',
    title: 'Suggestions',
    desc: 'Modérer les events / artistes proposés.',
  },
  { href: '/admin/feedback', title: 'Feedback', desc: 'Retours utilisateurs (idée / bug / data).' },
  { href: '/admin/reports', title: 'Reports', desc: 'Commentaires signalés.' },
]

const STATUS_STYLE: Record<string, string> = {
  ok: 'bg-emerald-500/15 text-emerald-500',
  partial: 'bg-amber/15 text-amber',
  error: 'bg-destructive/15 text-destructive',
}

export default async function AdminHub() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdmin(user.email)) redirect('/')

  // Même évaluation que /api/cron/monitor : la carte montre ce que le monitor
  // verrait à l'instant T (fraîcheur PAR FAMILLE — audit §7.6).
  const [health, activation, { data: tierRows }] = await Promise.all([
    getSourceHealth(),
    getActivationStats(),
    supabase.from('groups').select('confidence'),
  ])
  // Tiers de confiance (Phase 3 Lot 2) — internes : visibles ici seulement.
  const tierCounts = new Map<string, number>()
  for (const r of tierRows ?? []) {
    tierCounts.set(r.confidence, (tierCounts.get(r.confidence) ?? 0) + 1)
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground text-sm">
          Éditeurs ciblés. Le CRUD brut (création / suppression en masse) passe par Supabase Studio.
        </p>
      </div>

      {health && (
        <section className="bg-card mt-6 rounded-xl border p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-medium">Source health</h2>
            <span className="text-muted-foreground text-xs">
              {health.alerts.length === 0
                ? 'Toutes les familles sont saines'
                : `${health.alerts.length} alerte${health.alerts.length > 1 ? 's' : ''}`}
            </span>
          </div>
          {/* Tiers de confiance (audit §4.1) : candidate = noindex + hors
              sitemap + jamais notifié ; monitored = notifs à forte confiance. */}
          <p className="text-muted-foreground mt-2 text-xs">
            Confidence tiers :{' '}
            {(['verified', 'monitored', 'candidate'] as const).map((tier, i) => (
              <span key={tier}>
                {i > 0 && ' · '}
                <span className="text-foreground tabular font-semibold">
                  {tierCounts.get(tier) ?? 0}
                </span>{' '}
                {tier}
              </span>
            ))}
          </p>
          <ul className="mt-3 space-y-1.5">
            {health.checks.map((c) => (
              <li key={c.source} className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={cn(
                    'tabular rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                    STATUS_STYLE[c.lastStatus ?? ''] ?? 'bg-muted text-muted-foreground',
                  )}
                >
                  {c.lastStatus ?? 'no run'}
                </span>
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                <span className="text-muted-foreground text-xs">
                  {c.lastRunAt ? relativeTime(c.lastRunAt) : 'jamais logué'}
                </span>
              </li>
            ))}
          </ul>
          {health.alerts.length > 0 && (
            <ul className="text-destructive mt-3 space-y-1 border-t pt-3 text-xs">
              {health.alerts.map((a) => (
                <li key={a}>⚠ {a}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activation && (
        <section className="bg-card mt-6 rounded-xl border p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-medium">Activation</h2>
            <span className="text-muted-foreground text-xs">7 j / 30 j</span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {activation.funnel.map((step) => (
              <li key={step.event} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{step.label}</span>
                <span className="tabular text-xs font-semibold">{step.last7}</span>
                <span className="tabular text-muted-foreground w-10 text-right text-xs">
                  {step.last30}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t pt-3">
            <p className="label-data">North-star — actifs calendrier / semaine</p>
            {activation.northStar.length === 0 ? (
              <p className="text-muted-foreground mt-1 text-xs">Aucune donnée encore.</p>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {activation.northStar.map((w) => (
                  <li key={w.weekStart} className="flex items-center gap-2 text-xs">
                    <span className="tabular text-muted-foreground">{w.weekStart}</span>
                    <span className="tabular font-semibold">{w.users}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {activation.emptySearches.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="label-data">Recherches sans résultat</p>
              <ul className="mt-1 space-y-0.5">
                {activation.emptySearches.map((s, i) => (
                  <li key={`${s.at}-${i}`} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium">« {s.q} »</span>
                    <span className="text-muted-foreground">{s.seg}</span>
                    <span className="text-muted-foreground">{relativeTime(s.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {activation.notifSent.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="label-data">Notifs envoyées — 7 j</p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                {activation.notifSent.map((n) => (
                  <li key={n.kind} className="text-xs">
                    <span className="text-muted-foreground">{n.kind}</span>{' '}
                    <span className="tabular font-semibold">{n.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="bg-card hover:bg-hover rounded-xl border p-4 transition-colors"
          >
            <p className="font-medium">{s.title}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
