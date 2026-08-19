import type { ReactNode } from 'react'
import { requireAdminPage } from '@/lib/auth/require-admin'
import { getAdminNavCounts } from '@/lib/admin/nav-counts'
import { AdminNav } from '@/components/admin/admin-nav'

// Gate central de TOUT /admin/* (Lot D 2026-07-18) : une future page admin ne
// peut plus oublier sa garde. Les pages gardent la leur (défense en profondeur).
// Nav persistante (2026-08-19, demande Rudy) : sous-pages + badges pending
// accessibles depuis toute page admin — /admin/health et /admin/kpi n'avaient
// aucun accès direct hors URL tapée à la main.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage()
  const counts = await getAdminNavCounts()
  return (
    <>
      <AdminNav counts={counts} />
      {children}
    </>
  )
}
