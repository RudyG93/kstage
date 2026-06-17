import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { Avatar } from '@/components/avatar'
import { GroupCard } from '@/components/group-card'
import { MvsGrid } from '@/components/group/mvs-grid'
import { ProfileAvatar } from '@/components/profile/profile-avatar'
import { ProfilePicker, type PickerItem } from '@/components/profile/profile-picker'
import { PushBell } from '@/components/notifications/push-bell'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { createClient } from '@/lib/supabase/server'
import { getProfileByUsername, getProfileStats } from '@/lib/profiles/queries'
import { setBias, setFavoriteGroup } from '@/lib/profiles/actions'
import { getAllMembers } from '@/lib/members/queries'
import { getGroups, type GroupSummary } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getLikedMvs } from '@/lib/events/queries'
import { getRatingsForEvents } from '@/lib/events/community'
import { isAdmin } from '@/lib/auth/admin'
import { getPendingSuggestionsCount } from '@/lib/suggestions/queries'

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
  let memberItems: PickerItem[] = []
  let groupItems: PickerItem[] = []
  let followedGroups: GroupSummary[] = []
  if (isOwner && user) {
    admin = isAdmin(user.email)
    const [pending, members, groups, followedIds, countRes] = await Promise.all([
      admin ? getPendingSuggestionsCount() : Promise.resolve(0),
      getAllMembers(),
      getGroups(),
      getFollowedGroupIds(),
      supabase.rpc('group_follow_counts'),
    ])
    pendingCount = pending
    memberItems = members.map((m) => ({
      id: m.id,
      name: m.stage_name,
      avatar: m.photo_url,
      subtitle: one(m.groups)?.name,
    }))
    groupItems = groups.map((g) => ({ id: g.id, name: g.name, avatar: g.image_url }))
    // Groupes suivis (owner-only ; follows sous RLS), triés popularité puis alpha.
    const followCount = new Map((countRes.data ?? []).map((r) => [r.group_id, r.follows]))
    followedGroups = groups
      .filter((g) => followedIds.has(g.id))
      .sort(
        (a, b) =>
          (followCount.get(b.id) ?? 0) - (followCount.get(a.id) ?? 0) ||
          a.name.localeCompare(b.name),
      )
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
          {isOwner && (
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {admin && (
                <>
                  <Link
                    href="/admin/suggestions"
                    className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                  >
                    Admin{pendingCount > 0 ? ` (${pendingCount})` : ''}
                  </Link>
                  <Link
                    href="/admin/reports"
                    className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                  >
                    Reports
                  </Link>
                </>
              )}
              <PushBell />
              <Link
                href="/account"
                aria-label="Account settings"
                className="text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:ring-ring/50 inline-flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2"
              >
                <Settings className="size-5" aria-hidden />
              </Link>
            </div>
          )}
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
                className="bg-card border-border shadow-soft rounded-xl border p-3 text-center"
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
              <div className="bg-card border-border shadow-soft flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border p-3">
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
                className="bg-card border-border shadow-soft hover:bg-muted/40 flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border p-3 transition-colors"
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

        {isOwner && followedGroups.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Followed groups</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {followedGroups.map((g) => (
                <GroupCard key={g.id} group={g} isFollowing isAuthed />
              ))}
            </div>
          </section>
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
      </div>
    </div>
  )
}
