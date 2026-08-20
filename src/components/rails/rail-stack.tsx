import type { ReactNode } from 'react'

/** Wrapper commun des compositions de rail droit (sticky + espacement) —
    chaque page empile ses blocs contextuels dedans (Lot 6, 2026-08-20). */
export function RailStack({ children }: { children: ReactNode }) {
  return <div className="space-y-4 lg:sticky lg:top-20">{children}</div>
}
