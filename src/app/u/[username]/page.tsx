import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/avatar'
import { MvsGrid } from '@/components/group/mvs-grid'
import { ProfileAvatar } from '@/components/profile/profile-avatar'
import { ProfileSettings } from '@/components/profile/profile-settings'
import { ProfilePicker, type PickerItem } from '@/components/profile/profile-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { createClient } from '@/lib/supabase/server'
import { getProfileByUsername, getProfileStats } from '@/lib/profiles/queries'
import { setBias, setFavoriteGroup } from '@/lib/profiles/actions'
import { getAllMembers } from '@/lib/members/queries'
import { getGroups } from '@/lib/groups/queries'
import { getLikedMvs } from '@/lib/events/queries'
import { getRatingsForEvents } from '@/lib/events/community'
import { isAdmin } from '@/lib/auth/admin'
import {
  getMySuggestions,
  getPendingSuggestionsCount,
  type MySuggestion,
} from '@/lib/suggestions/queries'

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

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

  const [stats, likedMvs] = await Promise.all([
    getProfileStats(profile.id),
    getLikedMvs(profile.id, 30),
  ])
  const ratings = await getRatingsForEvents(likedMvs.map((m) => m.id))

  const bias = one(profile.bias)
  const favorite = one(profile.favorite)

  let admin = false
  let pendingCount = 0
  let mySuggestions: MySuggestion[] = []
  let memberItems: PickerItem[] = []
  let groupItems: PickerItem[] = []
  if (isOwner && user) {
    admin = isAdmin(user.email)
    const [sugg, pending, members, groups] = await Promise.all([
      getMySuggestions(),
      admin ? getPendingSuggestionsCount() : Promise.resolve(0),
      getAllMembers(),
      getGroups(),
    ])
    mySuggestions = sugg
    pendingCount = pending
    memberItems = members.map((m) => ({
      id: m.id,
      name: m.stage_name,
      avatar: m.photo_url,
      subtitle: one(m.groups)?.name,
    }))
    groupItems = groups.map((g) => ({ id: g.id, name: g.name, avatar: g.image_url }))
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
          </div>
        </header>

        {stats && (
          <dl className="grid grid-cols-4 gap-2">
            {(
              [
                ['Following', stats.followed],
                ['Rated', stats.rated],
                ['Liked', stats.liked],
                ['Comments', stats.comments],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="bg-card ring-foreground/10 rounded-xl p-3 text-center ring-1"
              >
                <dd className="text-lg font-bold tabular-nums">{value}</dd>
                <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">
                  {label}
                </dt>
              </div>
            ))}
          </dl>
        )}

        {(isOwner || bias || favorite) && (
          <div className="flex gap-3">
            {isOwner ? (
              <ProfilePicker
                label="Bias"
                current={bias ? { name: bias.stage_name, avatar: bias.photo_url } : null}
                items={memberItems}
                onSelect={setBias}
              />
            ) : bias ? (
              // Non cliquable : la page membre /artists/[slug] est quasi-vide (pruning).
              <div className="bg-card ring-foreground/10 flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-3 ring-1">
                <Avatar username={bias.stage_name} avatarUrl={bias.photo_url} size={36} />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[11px] tracking-wide uppercase">Bias</p>
                  <p className="truncate text-sm font-medium">{bias.stage_name}</p>
                </div>
              </div>
            ) : null}
            {isOwner ? (
              <ProfilePicker
                label="Favorite"
                current={favorite ? { name: favorite.name, avatar: favorite.image_url } : null}
                items={groupItems}
                onSelect={setFavoriteGroup}
              />
            ) : favorite ? (
              <Link
                href={`/groups/${favorite.slug}`}
                className="bg-card ring-foreground/10 hover:bg-muted/40 flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-3 ring-1 transition-colors"
              >
                <Avatar username={favorite.name} avatarUrl={favorite.image_url} size={36} />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
                    Favorite
                  </p>
                  <p className="truncate text-sm font-medium">{favorite.name}</p>
                </div>
              </Link>
            ) : null}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Liked MVs</h2>
          {likedMvs.length === 0 ? (
            <EmptyState
              title="No liked MVs yet"
              description={
                isOwner
                  ? 'Tap the heart on a music video to keep it here.'
                  : "This user hasn't liked any MV yet."
              }
              action={isOwner ? { label: 'Explore MVs', href: '/mvs' } : undefined}
            />
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
