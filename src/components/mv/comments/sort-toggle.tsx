import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { SortMode } from '@/lib/comments/tree'

/** Segments condensés Top / New (§7.7.4), URL-driven. */
export function SortToggle({ slug, sort }: { slug: string; sort: SortMode }) {
  return (
    <nav
      aria-label="Sort comments"
      className="bg-secondary inline-flex gap-0.5 rounded-md border p-0.5"
    >
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
        'label-data-inline focus-visible:ring-ring/50 rounded-sm px-2.5 py-1 text-[9px] outline-none focus-visible:ring-2',
        isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
