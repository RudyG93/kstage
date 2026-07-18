import type { ReactNode } from 'react'
import type { Route } from 'next'
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
  as: Heading = 'h2',
}: {
  label: ReactNode
  /** Annotation discrète à côté du label — ex. « All groups » quand un module
   * affiche un repli GLOBAL au lieu du contenu suivi (audit §8.4 : les
   * fallbacks silencieux rendaient le comportement illisible). */
  note?: string
  action?: { label: string; href: Route }
  /** Slot libre à droite (segmented control…) — exclusif avec `action`. */
  right?: ReactNode
  className?: string
  /** Vrai heading (a11y §8.6 : les panels n'étaient que des <span> — un
   * lecteur d'écran ne pouvait pas naviguer par sections). Aspect inchangé. */
  as?: 'h2' | 'h3'
}) {
  return (
    <div className={cn('flex items-center justify-between border-b px-3 py-2', className)}>
      <Heading className="label-data">
        {label}
        {note && <span className="label-data-inline text-faint ml-2 text-[9px]">{note}</span>}
      </Heading>
      {right}
      {!right && action && (
        <Link
          href={action.href}
          className="label-data-inline text-primary hover:text-primary/80 text-[10px] font-semibold transition-colors"
        >
          {action.label} →
        </Link>
      )}
    </div>
  )
}
