import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// Panneau Data Desk : carte hairline rayon 10px, header interne avec label
// condensé + action optionnelle (« ALL → », « CALENDAR → »). Utilisé par tous
// les modules d'écran (§7).
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('bg-card overflow-hidden rounded-lg border', className)}>
      {children}
    </section>
  )
}

export function PanelHeader({
  label,
  action,
  className,
}: {
  label: ReactNode
  action?: { label: string; href: string }
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between border-b px-3 py-2', className)}>
      <span className="label-data">{label}</span>
      {action && (
        <Link
          href={action.href}
          className="label-data-inline text-primary hover:text-primary/80 text-[9.5px] font-semibold transition-colors"
        >
          {action.label} →
        </Link>
      )}
    </div>
  )
}
