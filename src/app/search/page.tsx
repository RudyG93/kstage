import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { SearchInput } from '@/components/search/search-input'
import { QueueRow } from '@/components/events/queue-row'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { FollowButton } from '@/components/follow-button'
import { EmptyState } from '@/components/ui/empty-state'
import { searchGroups, searchMvs, searchEvents, searchMembers } from '@/lib/search/queries'
import { groupMusicShowEpisodes } from '@/lib/events/grouping'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { displaySongTitle } from '@/lib/events/title'
import { faceCrop } from '@/lib/images/cloudinary'
import { createClient } from '@/lib/supabase/server'
import { getViewerTimeZone } from '@/lib/profiles/timezone'
import { trackEvent } from '@/lib/analytics/track'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search k-pop groups, artists, MVs and events on KStage.',
}

type Segment = 'all' | 'groups' | 'artists' | 'mvs' | 'events'
const SEGMENTS: Segment[] = ['all', 'groups', 'artists', 'mvs', 'events']

// Recherche globale (§7.3) : groupes + MVs + events — le gap « findabilité »
// de l'audit UX. Server component sur ?q=&seg=, saisie debouncée côté client.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; seg?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const seg: Segment = SEGMENTS.includes(sp.seg as Segment) ? (sp.seg as Segment) : 'all'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const timeZone = await getViewerTimeZone()

  const [groups, members, mvs, events, followedIds] = q
    ? await Promise.all([
        seg === 'all' || seg === 'groups' ? searchGroups(q) : Promise.resolve([]),
        seg === 'all' || seg === 'artists' ? searchMembers(q) : Promise.resolve([]),
        seg === 'all' || seg === 'mvs' ? searchMvs(q) : Promise.resolve([]),
        seg === 'all' || seg === 'events' ? searchEvents(q) : Promise.resolve([]),
        getFollowedGroupIds(),
      ])
    : [[], [], [], [], new Set<string>()]

  const hasResults = groups.length > 0 || members.length > 0 || mvs.length > 0 || events.length > 0

  // Signal produit « trou de catalogue » (audit §10.3) : chaque recherche vide
  // compte (pas de dédup) — c'est la liste brute qui intéresse l'admin.
  if (q && !hasResults) {
    await trackEvent('search_no_results', {
      userId: user?.id ?? null,
      props: { q: q.slice(0, 80), seg },
    })
  }
  const segHref = (target: Segment) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (target !== 'all') params.set('seg', target)
    const qs = params.toString()
    return qs ? `/search?${qs}` : '/search'
  }

  const topResult = groups[0]

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 md:px-4 md:py-6">
      <div className="space-y-3">
        <SearchInput />

        <nav aria-label="Search scope" className="flex gap-1">
          {SEGMENTS.map((s) => (
            <Link
              key={s}
              href={segHref(s)}
              aria-current={seg === s ? 'true' : undefined}
              className={cn(
                'label-data-inline rounded-sm px-2.5 py-1.5 text-[9px] transition-colors',
                seg === s
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s === 'mvs' ? 'MVs' : s}
            </Link>
          ))}
        </nav>

        {!q ? (
          <p className="text-faint pt-6 text-center text-xs">
            Search covers groups, artists, MVs and events — one box for everything.
          </p>
        ) : !hasResults ? (
          <EmptyState
            title={`No results for “${q}”`}
            description="Try another spelling, or browse the full directory."
            action={{ label: 'Browse groups', href: '/groups' }}
          />
        ) : (
          <div className="space-y-3">
            {topResult && (
              <Panel>
                <PanelHeader label="Top result" />
                <div className="relative">
                  <Link
                    href={
                      topResult.is_solo ? `/groups/${topResult.slug}` : `/groups/${topResult.slug}`
                    }
                    className="hover:bg-secondary/60 flex items-center gap-3 p-3 pr-24 transition-colors"
                  >
                    {topResult.image_url ? (
                      <Image
                        src={faceCrop(topResult.image_url, 92, 92)}
                        alt=""
                        width={46}
                        height={46}
                        unoptimized
                        className="size-[46px] shrink-0 rounded-lg object-cover"
                        aria-hidden
                      />
                    ) : (
                      <span
                        className="gradient-signature flex size-[46px] shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white"
                        aria-hidden
                      >
                        {topResult.name[0]}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{topResult.name}</span>
                      <span className="text-muted-foreground block truncate text-[10px]">
                        {topResult.is_solo ? 'Solo' : 'Group'}
                        {topResult.agency ? ` · ${topResult.agency}` : ''}
                      </span>
                    </span>
                  </Link>
                  <div className="absolute top-1/2 right-3 -translate-y-1/2">
                    <FollowButton
                      groupId={topResult.id}
                      initialFollowing={followedIds.has(topResult.id)}
                      isAuthed={!!user}
                      pill
                    />
                  </div>
                </div>
              </Panel>
            )}

            {groups.length > 1 && (
              <Panel>
                <PanelHeader label="Groups" />
                <div className="divide-y">
                  {groups.slice(1).map((g) => (
                    <Link
                      key={g.id}
                      href={`/groups/${g.slug}`}
                      className="hover:bg-secondary/60 flex min-h-[44px] items-center gap-2.5 px-3 py-1.5 transition-colors"
                    >
                      {g.image_url ? (
                        <Image
                          src={faceCrop(g.image_url, 64, 64)}
                          alt=""
                          width={32}
                          height={32}
                          unoptimized
                          className="size-8 shrink-0 rounded-[7px] object-cover"
                          aria-hidden
                        />
                      ) : (
                        <span
                          className="gradient-signature flex size-8 shrink-0 items-center justify-center rounded-[7px] text-xs font-bold text-white"
                          aria-hidden
                        >
                          {g.name[0]}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{g.name}</span>
                        <span className="text-muted-foreground block truncate text-[10px]">
                          {g.is_solo ? 'Solo' : 'Group'}
                          {g.agency ? ` · ${g.agency}` : ''}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </Panel>
            )}

            {members.length > 0 && (
              <Panel>
                <PanelHeader label="Artists" />
                <div className="divide-y">
                  {members.map((m) => (
                    <Link
                      key={m.id}
                      href={`/artists/${m.slug}`}
                      className="hover:bg-secondary/60 flex min-h-[44px] items-center gap-2.5 px-3 py-1.5 transition-colors"
                    >
                      {m.photo_url ? (
                        <Image
                          src={faceCrop(m.photo_url, 64, 64)}
                          alt=""
                          width={32}
                          height={32}
                          unoptimized
                          className="size-8 shrink-0 rounded-full object-cover"
                          aria-hidden
                        />
                      ) : (
                        <span
                          className="gradient-signature flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          aria-hidden
                        >
                          {m.stage_name[0]}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{m.stage_name}</span>
                        <span className="text-muted-foreground block truncate text-[10px]">
                          {m.groups?.name}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </Panel>
            )}

            {mvs.length > 0 && (
              <Panel>
                <PanelHeader label="MVs" />
                <div className="divide-y">
                  {mvs.map((mv) => {
                    const videoId = extractYouTubeId(mv.source_url)
                    const thumb = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null
                    return (
                      <Link
                        key={mv.id}
                        href={`/mv/${mv.slug}`}
                        className="hover:bg-secondary/60 flex min-h-[44px] items-center gap-2.5 px-3 py-1.5 transition-colors"
                      >
                        {thumb ? (
                          <Image
                            src={thumb}
                            alt=""
                            width={56}
                            height={32}
                            unoptimized
                            className="h-8 w-14 shrink-0 rounded-sm object-cover"
                            aria-hidden
                          />
                        ) : (
                          <span className="bg-muted h-8 w-14 shrink-0 rounded-sm" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold">
                            {displaySongTitle(mv.title, mv.groups?.name)}
                          </span>
                          <span className="text-muted-foreground block truncate text-[10px]">
                            {mv.groups?.name}
                          </span>
                        </span>
                        {mv.rating && mv.rating.count > 0 && (
                          <span className="flex shrink-0 items-center gap-1">
                            <Star className="fill-amber text-amber size-3" aria-hidden />
                            <span className="tabular text-xs font-semibold">
                              {mv.rating.avg.toFixed(1)}
                            </span>
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </Panel>
            )}

            {events.length > 0 && (
              <Panel>
                <PanelHeader label="Events" />
                <div className="divide-y">
                  {groupMusicShowEpisodes(events).map((event) => (
                    <QueueRow key={event.id} event={event} timeZone={timeZone} showThumb />
                  ))}
                </div>
              </Panel>
            )}
          </div>
        )}

        {q && hasResults && (
          <p className="text-faint pt-2 text-center text-[10px]">
            Search covers groups, artists, MVs and events — one box for everything.
          </p>
        )}
      </div>
    </div>
  )
}
