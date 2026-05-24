import { GroupCard } from '@/components/group-card'
import { getGroups } from '@/lib/groups/queries'

export const metadata = { title: 'Groups' }

export default async function GroupsPage() {
  const groups = await getGroups()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((group) => (
          <GroupCard key={group.slug} group={group} />
        ))}
      </div>
    </div>
  )
}
