import type { ReactNode } from 'react'
import { requireAdminPage } from '@/lib/auth/require-admin'

// Gate central de TOUT /admin/* (Lot D 2026-07-18) : une future page admin ne
// peut plus oublier sa garde. Les pages gardent la leur (défense en profondeur).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage()
  return children
}
