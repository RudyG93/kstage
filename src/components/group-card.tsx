import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { FollowButton } from '@/components/follow-button'
import type { GroupSummary } from '@/lib/groups/queries'

/**
 * Carte groupe. `href` optionnel permet de pointer directement vers
 * `/artists/[memberSlug]` côté tab Solo (évite le détour /groups → re-clic
 * sur le membre unique). Default = `/groups/[slug]` (comportement legacy).
 */
export function GroupCard({
  group,
  isFollowing,
  isAuthed,
  href,
}: {
  group: GroupSummary
  isFollowing: boolean
  isAuthed: boolean
  href?: string
}) {
  return (
    <Card size="sm" className="px-4">
      <div className="flex items-center gap-3">
        <Link
          href={href ?? `/groups/${group.slug}`}
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
