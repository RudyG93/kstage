'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { AdminNavCounts } from '@/lib/admin/nav-counts'

// Nav admin persistante (2026-08-19) : jusqu'ici seul le hub listait les
// sous-pages — /admin/health et /admin/kpi n'étaient accessibles qu'en tapant
// l'URL. Badges = files de revue avec du pending (où agir).
const ITEMS: { href: string; label: string; badge?: keyof AdminNavCounts }[] = [
  { href: '/admin', label: 'Hub' },
  { href: '/admin/kpi', label: 'KPI' },
  { href: '/admin/health', label: 'Health' },
  { href: '/admin/debuts', label: 'Debuts', badge: 'debuts' },
  { href: '/admin/suggestions', label: 'Suggestions', badge: 'suggestions' },
  { href: '/admin/feedback', label: 'Feedback', badge: 'feedback' },
  { href: '/admin/reports', label: 'Reports', badge: 'reports' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/images', label: 'Images' },
  { href: '/admin/banners', label: 'Banners' },
]

export function AdminNav({ counts }: { counts: AdminNavCounts }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Admin" className="border-b">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-1 overflow-x-auto px-4 py-2">
        {ITEMS.map((item) => {
          const active =
            item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
          const badge = item.badge ? counts[item.badge] : 0
          return (
            <Link
              key={item.href}
              href={item.href as Route}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-hover',
              )}
            >
              {item.label}
              {badge > 0 && (
                <span className="tabular bg-primary/15 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
