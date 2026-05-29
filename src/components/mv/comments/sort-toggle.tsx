import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { SortMode } from '@/lib/comments/tree'

/**
 * Toggle URL-driven Top / New pour le tri des commentaires.
 * Pattern visuel aligné sur `src/app/groups/page.tsx:67-93` (TabLink Groups/Solo).
 */
export function SortToggle({ slug, sort }: { slug: string; sort: SortMode }) {
  return (
    <nav aria-label="Sort comments" className="bg-muted inline-flex rounded-lg p-0.5 text-xs">
      <SortLink slug={slug} target="top" current={sort}>
        Top
      </SortLink>
      <SortLink slug={slug} target="new" current={sort}>
        New
      </SortLink>
    </nav>
  )
}

function SortLink({
  slug,
  target,
  current,
  children,
}: {
  slug: string
  target: SortMode
  current: SortMode
  children: React.ReactNode
}) {
  const isActive = current === target
  // `top` est le défaut → pas de query param dans l'URL canonique.
  const href = target === 'top' ? `/mv/${slug}#comments` : `/mv/${slug}?sort=new#comments`
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      scroll={false}
      className={cn(
        'focus-visible:ring-ring/50 rounded-md px-2.5 py-1 font-medium outline-none focus-visible:ring-2',
        isActive
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
