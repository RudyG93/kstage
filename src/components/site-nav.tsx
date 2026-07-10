'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarIcon, Disc3Icon, HouseIcon, SearchIcon, UsersIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Data Desk §6 : 5 entrées, Search central en FAB sur mobile.
const ITEMS = [
  { href: '/', label: 'Home', Icon: HouseIcon, fab: false },
  { href: '/calendar', label: 'Calendar', Icon: CalendarIcon, fab: false },
  { href: '/search', label: 'Search', Icon: SearchIcon, fab: true },
  { href: '/mvs', label: 'Drops', Icon: Disc3Icon, fab: false },
  { href: '/groups', label: 'Groups', Icon: UsersIcon, fab: false },
] as const

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Deux rendus séparés : les pills desktop vivent dans le header, la barre mobile
// est rendue HORS du header — son backdrop-filter piège les descendants fixed
// (containing block, cf. PROJECT.md §9 « nav piégée par le backdrop-filter »).
export function SiteNav({ variant }: { variant: 'header' | 'bottom' }) {
  const pathname = usePathname()

  if (variant === 'header') {
    return (
      <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
        {ITEMS.map(({ href, label }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'label-data-inline rounded-lg px-3 py-2 text-[10px] transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav
      aria-label="Primary"
      className="bg-card/95 fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {ITEMS.map(({ href, label, Icon, fab }) => {
        const active = isActive(pathname, href)
        if (fab) {
          return (
            <div key={href} className="flex flex-1 items-start justify-center">
              {/* FAB : carré 46px surélevé de 14px (§6). */}
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className="bg-primary text-primary-foreground flex size-[46px] -translate-y-[14px] items-center justify-center rounded-2xl shadow-[0_8px_20px_rgba(125,122,255,.4)] transition-opacity hover:opacity-90"
              >
                <SearchIcon className="size-5" />
              </Link>
            </div>
          )
        }
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 pt-2.5 pb-2 transition-colors',
              active ? 'text-primary' : 'text-faint hover:text-foreground',
            )}
          >
            <Icon className="size-5" />
            <span className="label-data-inline text-[8.5px]">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
