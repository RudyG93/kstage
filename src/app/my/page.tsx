import Link from 'next/link'
import { redirect } from 'next/navigation'
import { EventList } from '@/components/event-list'
import { IosInstallHint } from '@/components/notifications/ios-install-hint'
import { PushToggle } from '@/components/notifications/push-toggle'
import { buttonVariants } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getUpcomingEvents } from '@/lib/events/queries'

export const metadata = { title: 'My events' }

export default async function MyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const followedIds = await getFollowedGroupIds()

  if (followedIds.size === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">My events</h1>
        <div className="space-y-3 py-12 text-center">
          <p className="text-muted-foreground text-sm">You don&apos;t follow any groups yet.</p>
          <Link href="/groups" className={buttonVariants()}>
            Browse groups
          </Link>
        </div>
      </div>
    )
  }

  const events = await getUpcomingEvents({ groupIds: [...followedIds], limit: 100 })

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">My events</h1>
        <p className="text-muted-foreground text-sm">Upcoming events from the groups you follow.</p>
      </div>
      <IosInstallHint />
      <PushToggle />
      <EventList events={events} emptyMessage="No upcoming events from your groups yet." />
    </div>
  )
}
