import Link from 'next/link'
import { redirect } from 'next/navigation'
import { GroupedEventList } from '@/components/grouped-event-list'
import { IosInstallHint } from '@/components/notifications/ios-install-hint'
import { PushToggle } from '@/components/notifications/push-toggle'
import { MySuggestions } from '@/components/suggestions/my-suggestions'
import { buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getUpcomingEvents } from '@/lib/events/queries'
import { getMySuggestions, getPendingSuggestionsCount } from '@/lib/suggestions/queries'

export const metadata = { title: 'My events' }

export default async function MyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [followedIds, mySuggestions] = await Promise.all([
    getFollowedGroupIds(),
    getMySuggestions(),
  ])
  const admin = isAdmin(user.email)
  const pendingCount = admin ? await getPendingSuggestionsCount() : 0
  const events =
    followedIds.size > 0 ? await getUpcomingEvents({ groupIds: [...followedIds], limit: 100 }) : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">My events</h1>
          <p className="text-muted-foreground text-sm">
            Upcoming events from the groups you follow.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/suggest" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Suggest an event
          </Link>
          {admin && (
            <Link
              href="/admin/suggestions"
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              Admin{pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Link>
          )}
        </div>
      </div>

      <IosInstallHint />
      <PushToggle />

      {followedIds.size === 0 ? (
        <div className="space-y-3 py-8 text-center">
          <p className="text-muted-foreground text-sm">You don&apos;t follow any groups yet.</p>
          <Link href="/groups" className={buttonVariants()}>
            Browse groups
          </Link>
        </div>
      ) : (
        <GroupedEventList events={events} emptyMessage="No upcoming events from your groups yet." />
      )}

      <MySuggestions suggestions={mySuggestions} />
    </div>
  )
}
