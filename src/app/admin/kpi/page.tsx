import { requireAdminPage } from '@/lib/auth/require-admin'
import { getKpiStats } from '@/lib/analytics/admin'

export const metadata = { title: 'KPI' }

// KPI de suivi de l'app (demande Rudy 2026-08-19) : croissance, engagement,
// usage, catalogue — la photo hebdo en un écran. Le funnel détaillé et le
// north-star restent sur la carte Activation du hub ; le détail data vit sur
// /admin/health.
function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="label-data">{label}</p>
      <p className="tabular mt-1 text-2xl font-bold">{Intl.NumberFormat('en').format(value)}</p>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
    </div>
  )
}

export default async function AdminKpiPage() {
  await requireAdminPage()
  const kpi = await getKpiStats()
  if (!kpi) return null

  const coverage =
    kpi.catalog.groups > 0
      ? Math.round((kpi.catalog.groupsWithUpcoming / kpi.catalog.groups) * 100)
      : 0

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">KPI</h1>
        <p className="text-muted-foreground text-sm">
          Croissance · engagement · usage · catalogue. Fenêtres 7 j / 30 j. Le funnel détaillé est
          sur le hub, la santé data sur Health.
        </p>
      </div>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold">Croissance</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="Comptes" value={kpi.users.total} />
          <Tile label="Nouveaux — 7 j" value={kpi.users.last7} />
          <Tile label="Nouveaux — 30 j" value={kpi.users.last30} />
        </div>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold">Engagement</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile
            label="Users avec ≥1 follow"
            value={kpi.engagement.usersWithFollow}
            hint={`${kpi.engagement.followsTotal} follows au total`}
          />
          <Tile
            label="Push actifs"
            value={kpi.engagement.pushUsers}
            hint={`${kpi.engagement.pushSubscriptions} appareils`}
          />
          <Tile label="Digests envoyés — 7 j" value={kpi.engagement.digestsSent7} />
        </div>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold">Usage (users connectés actifs)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Tile label="WAU — 7 j" value={kpi.usage.wau} />
          <Tile label="MAU — 30 j" value={kpi.usage.mau} />
        </div>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold">Catalogue</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile
            label="Groupes"
            value={kpi.catalog.groups}
            hint={`${kpi.catalog.groupsWithUpcoming} avec un event futur (${coverage} %)`}
          />
          <Tile label="Events futurs" value={kpi.catalog.upcomingEvents} />
          <Tile
            label="MVs visibles"
            value={kpi.catalog.visibleMvs}
            hint={`${kpi.catalog.members} artistes canoniques`}
          />
        </div>
      </section>
    </div>
  )
}
