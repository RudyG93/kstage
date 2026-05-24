import Link from 'next/link'
import { Card } from '@/components/ui/card'
import type { GroupSummary } from '@/lib/groups/queries'

export function GroupCard({ group }: { group: GroupSummary }) {
  return (
    <Link
      href={`/groups/${group.slug}`}
      className="focus-visible:ring-ring/50 block rounded-xl outline-none focus-visible:ring-3"
    >
      <Card size="sm" className="hover:bg-muted/50 px-4 transition-colors">
        <div className="flex items-center gap-3">
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: group.color_hex ?? 'var(--muted-foreground)' }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-medium">{group.name}</p>
            {group.agency && (
              <p className="text-muted-foreground truncate text-xs">{group.agency}</p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}
