'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarIcon, ListIcon, PlayCircleIcon, UsersIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/', label: 'Upcoming', Icon: ListIcon },
  { href: '/calendar', label: 'Calendar', Icon: CalendarIcon },
  { href: '/mvs', label: 'MVs', Icon: PlayCircleIcon },
  { href: '/groups', label: 'Groups', Icon: UsersIcon },
] as const

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SiteNav() {
  const pathname = usePathname()
  const items = ITEMS

  return (
    <nav
      aria-label="Primary"
      className="bg-background/95 fixed inset-x-0 bottom-0 z-40 flex border-t backdrop-blur md:static md:border-t-0 md:bg-transparent md:backdrop-blur-none"
    >
      {items.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors md:flex-none md:flex-row md:gap-1.5 md:px-3 md:py-1.5 md:text-sm',
              active
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-5 md:size-4" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
