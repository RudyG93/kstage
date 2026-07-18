import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Settings } from 'lucide-react'
import { Avatar } from '@/components/avatar'
import { GroupCard } from '@/components/group-card'
import { MvsGrid } from '@/components/group/mvs-grid'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { ProfileAvatar } from '@/components/profile/profile-avatar'
import { ProfilePicker, type PickerItem } from '@/components/profile/profile-picker'
import { ProfileStats } from '@/components/profile/profile-stats'
import { PushBell } from '@/components/notifications/push-bell'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { createClient } from '@/lib/supabase/server'
import { getViewer } from '@/lib/supabase/viewer'
import { getProfileByUsername, getProfileStats } from '@/lib/profiles/queries'
import { setBias, setFavoriteGroup } from '@/lib/profiles/actions'
import { getAllMembers } from '@/lib/members/queries'
import { getGroups, type GroupSummary } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getLikedMvs } from '@/lib/events/queries'
import { getRatingsForEvents, getUserRatings } from '@/lib/events/community'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { monthYear, shortDate } from '@/lib/events/date'
import { getViewerTimeZone } from '@/lib/profiles/timezone'
import { displaySongTitle } from '@/lib/events/title'
import { isAdmin } from '@/lib/auth/admin'
import { getPendingSuggestionsCount } from '@/lib/suggestions/queries'

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const profile = await getProfileByUsername(decodeURIComponent(username))
  if (!profile) notFound()

  const supabase = await createClient()
  const { user } = await getViewer()
  const isOwner = user?.id === profile.id

  const [stats, likedMvs, userRatings, timeZone] = await Promise.all([
    getProfileStats(profile.id),
    getLikedMvs(profile.id, 30),
    getUserRatings(profile.id, 8),
    getViewerTimeZone(),
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
    <div className="mx-auto w-full max-w-3xl px-3 py-4 md:px-4 md:py-6">
      <div className="space-y-3">
        {/* Identité (§7.8.2) : avatar 64 ring primary, @user, fan since, EDIT.
            `flex` sur le wrapper : sans lui l'avatar (inline) laissait un
            interstice de baseline → ring décentré (retour Rudy 2026-07-12).
            Taille unifiée 64 owner/visiteur (l'owner rendait 112 dans un ring
            calibré 64). */}
        <header className="flex items-center gap-4">
          <div className="ring-primary flex shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-[var(--page)]">
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
                size={64}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading truncate text-xl font-extrabold tracking-[-0.01em]">
              {profile.username ?? 'User'}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Fan since {monthYear(profile.created_at)}
            </p>
          </div>
          {isOwner && (
            <div className="flex shrink-0 items-center gap-1">
              {admin && (
                <Link href="/admin" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  Admin{pendingCount > 0 ? ` (${pendingCount})` : ''}
                </Link>
              )}
              <PushBell />
              <Link
                href="/account"
                aria-label="Account settings"
                className="text-muted-foreground hover:text-foreground hover:bg-hover focus-visible:ring-ring/50 inline-flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2"
              >
                <Settings className="size-5" aria-hidden />
              </Link>
            </div>
          )}
        </header>

        {stats && (
          <ProfileStats
            following={stats.followed}
            rated={stats.rated}
            avg={userRatings.avg}
            likes={stats.liked}
          />
        )}

        {isOwner && (
          <div className="flex gap-3">
            <ProfilePicker
              label="Bias"
              current={bias ? { name: bias.stage_name, avatar: bias.photo_url } : null}
              items={memberItems}
              onSelect={setBias}
            />
            <ProfilePicker
              label="Favorite"
              current={favorite ? { name: favorite.name, avatar: favorite.image_url } : null}
              items={groupItems}
              onSelect={setFavoriteGroup}
            />
          </div>
        )}

        {/* Dernières notes (§7.8.4). */}
        {userRatings.recent.length > 0 && (
          <Panel>
            <PanelHeader label={isOwner ? 'Your recent ratings' : 'Recent ratings'} />
            <div className="divide-y">
              {userRatings.recent.map((r, i) => {
                const videoId = extractYouTubeId(r.sourceUrl)
                const thumb = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null
                return (
                  <Link
                    key={i}
                    href={r.eventSlug ? `/mv/${r.eventSlug}` : '/mvs'}
                    className="hover:bg-secondary/60 flex min-h-[44px] items-center gap-2.5 px-3 py-1.5 transition-colors"
                  >
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt=""
                        width={50}
                        height={28}
                        unoptimized
                        className="h-7 w-[50px] shrink-0 rounded-sm object-cover"
                        aria-hidden
                      />
                    ) : (
                      <span className="bg-muted h-7 w-[50px] shrink-0 rounded-sm" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">
                        {displaySongTitle(r.eventTitle, r.groupName ?? undefined)}
                      </span>
                      <span className="text-muted-foreground block truncate text-[10px]">
                        {r.groupName} · {shortDate(r.createdAt, 'UTC')}
                      </span>
                    </span>
                    <span className="tabular bg-amber/15 text-amber shrink-0 rounded-[4px] px-1.5 py-0.5 text-xs font-bold">
                      {r.score}
                    </span>
                  </Link>
                )
              })}
            </div>
          </Panel>
        )}

        {/* Ordre voulu (retour Rudy 2026-07-17) : ratings → Liked MVs → Followed groups. */}
        <section className="space-y-2">
          <span className="label-data">Liked MVs</span>
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
            <MvsGrid mvs={likedMvs} ratings={ratings} timeZone={timeZone} />
          )}
        </section>

        {isOwner && followedGroups.length > 0 && (
          <section className="space-y-2">
            <span className="label-data">Followed groups — {followedGroups.length}</span>
            <div className="grid grid-cols-3 gap-[9px] sm:grid-cols-4">
              {followedGroups.map((g) => (
                <GroupCard key={g.id} group={g} isFollowing isAuthed timeZone={timeZone} />
              ))}
            </div>
          </section>
        )}

        {/* Bloc Settings supprimé (R4-G) : l'écrou du header de page mène à
            /account et le toggle thème vit dans le header du site (mobile
            inclus depuis R4-G). */}
      </div>
    </div>
  )
}
