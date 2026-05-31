import { notFound } from 'next/navigation'
import { Avatar } from '@/components/avatar'
import { MvsGrid } from '@/components/group/mvs-grid'
import { ProfileAvatar } from '@/components/profile/profile-avatar'
import { ProfileSettings } from '@/components/profile/profile-settings'
import { createClient } from '@/lib/supabase/server'
import { getProfileByUsername } from '@/lib/profiles/queries'
import { countUserComments } from '@/lib/comments/queries'
import { getLikedMvs } from '@/lib/events/queries'
import { getRatingsForEvents } from '@/lib/events/community'
import { isAdmin } from '@/lib/auth/admin'
import {
  getMySuggestions,
  getPendingSuggestionsCount,
  type MySuggestion,
} from '@/lib/suggestions/queries'

const memberSince = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(iso),
  )

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const profile = await getProfileByUsername(decodeURIComponent(username))
  if (!profile) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isOwner = user?.id === profile.id

  const [commentCount, likedMvs] = await Promise.all([
    countUserComments(profile.id),
    getLikedMvs(profile.id, 30),
  ])
  const ratings = await getRatingsForEvents(likedMvs.map((m) => m.id))

  let admin = false
  let pendingCount = 0
  let mySuggestions: MySuggestion[] = []
  if (isOwner && user) {
    admin = isAdmin(user.email)
    const [sugg, pending] = await Promise.all([
      getMySuggestions(),
      admin ? getPendingSuggestionsCount() : Promise.resolve(0),
    ])
    mySuggestions = sugg
    pendingCount = pending
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-6">
        <header className="flex items-center gap-5">
          {isOwner ? (
            <ProfileAvatar
              email={user?.email ?? null}
              username={profile.username}
              avatarUrl={profile.avatar_url}
            />
          ) : (
            <Avatar
              username={profile.username ?? undefined}
              avatarUrl={profile.avatar_url}
              size={112}
            />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {profile.username ?? 'User'}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Member since {memberSince(profile.created_at)}
            </p>
            <p className="text-muted-foreground text-sm">
              {commentCount} comment{commentCount === 1 ? '' : 's'}
            </p>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Liked MVs</h2>
          {likedMvs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No liked MVs yet.</p>
          ) : (
            <MvsGrid mvs={likedMvs} ratings={ratings} />
          )}
        </section>

        {isOwner && (
          <ProfileSettings admin={admin} pendingCount={pendingCount} suggestions={mySuggestions} />
        )}
      </div>
    </div>
  )
}
