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
  note,
  action,
  right,
  className,
}: {
  label: ReactNode
  /** Annotation discrète à côté du label — ex. « All groups » quand un module
   * affiche un repli GLOBAL au lieu du contenu suivi (audit §8.4 : les
   * fallbacks silencieux rendaient le comportement illisible). */
  note?: string
  action?: { label: string; href: string }
  /** Slot libre à droite (segmented control…) — exclusif avec `action`. */
  right?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between border-b px-3 py-2', className)}>
      <span className="label-data">
        {label}
        {note && <span className="label-data-inline text-faint ml-2 text-[9px]">{note}</span>}
      </span>
      {right}
      {!right && action && (
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
