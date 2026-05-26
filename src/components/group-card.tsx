import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { FollowButton } from '@/components/follow-button'
import type { GroupSummary } from '@/lib/groups/queries'

export function GroupCard({
  group,
  isFollowing,
  isAuthed,
}: {
  group: GroupSummary
  isFollowing: boolean
  isAuthed: boolean
}) {
  return (
    <Card size="sm" className="px-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/groups/${group.slug}`}
          className="focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-3"
        >
          <span
            className="size-3.5 shrink-0 rounded-full"
            style={{
              backgroundColor: group.color_hex ?? 'var(--muted-foreground)',
              boxShadow: group.color_hex ? `0 0 10px ${group.color_hex}99` : undefined,
            }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-medium">{group.name}</p>
            {group.agency && (
              <p className="text-muted-foreground truncate text-xs">{group.agency}</p>
            )}
          </div>
        </Link>
        <FollowButton
          groupId={group.id}
          initialFollowing={isFollowing}
          isAuthed={isAuthed}
          className="shrink-0"
        />
      </div>
    </Card>
  )
}
