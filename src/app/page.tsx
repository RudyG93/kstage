import { Landing } from '@/components/landing'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { NextDropCard } from '@/components/home/next-drop-card'
import { Feed } from '@/components/home/feed'
import { RecentComebacksGrid } from '@/components/home/recent-comebacks-grid'
import { getGroupsCached } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getUpcomingEvents, getAllMvs } from '@/lib/events/queries'
import { getRatingsForEvents } from '@/lib/events/community'
import { getUpcomingAnniversaries } from '@/lib/events/anniversaries'
import { parseTypesParam } from '@/lib/events/filters'
import { createClient } from '@/lib/supabase/server'

// Types « vrai comeback » mis en avant par le hero (un anniversaire ne doit pas
// occuper la carte principale — il reste dans le feed).
const COMEBACK_TYPES = new Set(['mv', 'release', 'music_show', 'live'])

export default async function Home({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Landing = aperçu produit : la liste des groupes (cachée) + les vrais
    // prochains events (toutes sources) pour montrer le calendrier en action
    // plutôt qu'un mur de noms.
    const [groups, previewEvents] = await Promise.all([
      getGroupsCached(),
      getUpcomingEvents({ limit: 4 }),
    ])
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <Landing groups={groups} previewEvents={previewEvents} />
      </div>
    )
  }

  const sp = await searchParams
  const types = parseTypesParam(sp.type)
  const wantAnniversaries = types.length === 0 || types.includes('anniversary')

  // Fuseau de tri today/tomorrow/later : préférence user, fallback Séoul.
  // (la détection client pour l'anonyme + l'affichage heure-locale → §3.1)
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone, tier')
    .eq('id', user.id)
    .single()
  const timeZone = profile?.timezone ?? 'Asia/Seoul'
  const tier = profile?.tier ?? 'free'

  const followedIds = await getFollowedGroupIds()
  const ids = [...followedIds]
  const [dbEvents, anniversaries, followedMvs, recentMvs] = await Promise.all([
    ids.length > 0 ? getUpcomingEvents({ groupIds: ids, types, limit: 50 }) : Promise.resolve([]),
    ids.length > 0 && wantAnniversaries ? getUpcomingAnniversaries(ids, 90) : Promise.resolve([]),
    // « Valoriser la data » : grilles visuelles centrées (MV + notes).
    ids.length > 0 ? getAllMvs({ groupIds: ids, limit: 6 }) : Promise.resolve([]),
    getAllMvs({ limit: 6 }),
  ])
  const ratings = await getRatingsForEvents([...followedMvs, ...recentMvs].map((m) => m.id))

  // Hero = prochain VRAI comeback (pas un anniversaire) ; le reste va au feed.
  const merged = [...dbEvents, ...anniversaries].sort((a, b) =>
    a.start_at.localeCompare(b.start_at),
  )
  const heroIdx = merged.findIndex((e) => COMEBACK_TYPES.has(e.type))
  const nextDrop = heroIdx >= 0 ? merged[heroIdx] : null
  const feedEvents = heroIdx >= 0 ? merged.filter((_, i) => i !== heroIdx) : merged

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
          <SidebarLeft tier={tier} />
        </aside>
        <div className="order-1 min-w-0 flex-1 space-y-8 lg:order-2">
          {nextDrop && (
            <NextDropCard
              event={nextDrop}
              isAuthed
              isFollowing={nextDrop.group_id ? followedIds.has(nextDrop.group_id) : false}
            />
          )}
          <RecentComebacksGrid
            fromYourGroups={followedMvs}
            recent={recentMvs}
            ratings={ratings}
            hasFollows={ids.length > 0}
          />
          {ids.length > 0 && <Feed events={feedEvents} timeZone={timeZone} />}
        </div>
      </div>
    </div>
  )
}
