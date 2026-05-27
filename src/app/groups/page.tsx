import { GroupCard } from '@/components/group-card'
import { getGroups } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Groups' }

export default async function GroupsPage() {
  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    groups,
    followedIds,
  ] = await Promise.all([supabase.auth.getUser(), getGroups(), getFollowedGroupIds()])

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <GroupCard
              key={group.slug}
              group={group}
              isFollowing={followedIds.has(group.id)}
              isAuthed={!!user}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
