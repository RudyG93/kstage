import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * État vide actionnable réutilisable (anti-cul-de-sac). Au lieu d'un message
 * plat, propose un titre, une explication courte et une action (lien CTA).
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: { label: string; href: Route }
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-border/70 flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      {icon && <div className="text-muted-foreground/60 mb-1">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-muted-foreground max-w-xs text-sm">{description}</p>}
      {action && (
        <Link href={action.href} className={cn(buttonVariants({ size: 'sm' }), 'mt-2')}>
          {action.label}
        </Link>
      )}
    </div>
  )
}
