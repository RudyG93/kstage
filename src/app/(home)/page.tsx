import Link from 'next/link'
import { Landing } from '@/components/landing'
import { SidebarLeft } from '@/components/home/sidebar-left'
import { SidebarRight } from '@/components/home/sidebar-right'
import { NextDropCard } from '@/components/home/next-drop-card'
import { WeekGlance } from '@/components/home/week-glance'
import { FreshDrops } from '@/components/home/fresh-drops'
import { IosInstallHint } from '@/components/notifications/ios-install-hint'
import { QueueRow } from '@/components/events/queue-row'
import { Ticker } from '@/components/ticker'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { getGroupsCached } from '@/lib/groups/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import {
  getUpcomingEvents,
  getAllMvs,
  getGroupMvs,
  getEventsCount,
  type MvEvent,
} from '@/lib/events/queries'
import { getRatingsForEvents } from '@/lib/events/community'
import { getUpcomingAnniversaries } from '@/lib/events/anniversaries'
import { generateShowSlots } from '@/lib/events/show-slots'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { getSourcesStatus, getGroupSubscriberCounts } from '@/lib/sources/queries'
import { buildTickerItems, pickTickerEvents } from '@/lib/events/ticker'
import { groupMusicShowEpisodes } from '@/lib/events/grouping'
import { findHeroEventIndex } from '@/lib/events/hero'
import { parseTypesParam } from '@/lib/events/filters'
import { createClient } from '@/lib/supabase/server'
import { getViewerTimeZone } from '@/lib/profiles/timezone'
import { TrackView } from '@/components/analytics/track-view'

// Home Data Desk : ticker global → hero NEXT UP → UPCOMING QUEUE → THIS WEEK →
// FRESH DROPS, avec les sidebars My groups (gauche) et Recent comebacks /
// discussions (droite).
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; src?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const [groups, previewRaw, eventsCount, sourcesStatus, subscriberCounts] = await Promise.all([
      getGroupsCached(),
      // limit 12 puis groupement : un épisode multi-groupes ne doit pas manger
      // les 4 slots du preview avant de se replier en 1 carte.
      getUpcomingEvents({ limit: 12 }),
      getEventsCount(),
      getSourcesStatus(),
      getGroupSubscriberCounts(),
    ])
    const previewEvents = groupMusicShowEpisodes(previewRaw)
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <Landing
          groups={groups}
          previewEvents={previewEvents}
          eventsCount={eventsCount}
          sourcesStatus={sourcesStatus}
          subscriberCounts={subscriberCounts}
        />
      </div>
    )
  }

  const sp = await searchParams
  const types = parseTypesParam(sp.type)
  const wantAnniversaries = types.length === 0 || types.includes('anniversary')

  // Indépendants (les deux ne dépendent que de user.id) : en parallèle plutôt
  // que 2 allers-retours séquentiels sur la page connectée la plus chargée.
  const [timeZone, followedIds] = await Promise.all([getViewerTimeZone(), getFollowedGroupIds()])
  const ids = [...followedIds]
  const [dbEvents, anniversaries, followedMvs, recentMvs, globalEvents, { data: countRows }] =
    await Promise.all([
      ids.length > 0 ? getUpcomingEvents({ groupIds: ids, types, limit: 50 }) : Promise.resolve([]),
      ids.length > 0 && wantAnniversaries ? getUpcomingAnniversaries(ids, 90) : Promise.resolve([]),
      ids.length > 0 ? getAllMvs({ groupIds: ids, limit: 4 }) : Promise.resolve([]),
      getAllMvs({ limit: 4 }),
      // Ticker : annonces globales « qui tapent » (tous types, suivi ou non).
      getUpcomingEvents({ limit: 40 }),
      supabase.rpc('group_follow_counts'),
    ])

  // Fresh drops : les MVs des groupes suivis d'abord, complétés au global (4 max).
  const freshMvs: MvEvent[] = [...followedMvs]
  for (const mv of recentMvs) {
    if (freshMvs.length >= 4) break
    if (!freshMvs.some((m) => m.id === mv.id)) freshMvs.push(mv)
  }
  const ratings = await getRatingsForEvents(freshMvs.map((m) => m.id))

  // Hero = prochain vrai comeback (MV, release ou music show). Les anniversaires
  // et les données live héritées restent disponibles dans les autres surfaces.
  // Groupement AVANT le cap de la queue : un épisode à 5 groupes = 1 carte.
  const merged = groupMusicShowEpisodes(
    [...dbEvents, ...anniversaries].sort((a, b) => a.start_at.localeCompare(b.start_at)),
  )
  const heroIdx = findHeroEventIndex(merged)
  const nextDrop = heroIdx >= 0 ? merged[heroIdx] : null

  // Fond du hero : thumbnail maxres du DERNIER MV du groupe du hero — le
  // visuel le plus frais (les banners/landscapes seedés datent, ex. fanart
  // aespa 2021). Une petite query dédiée : followedMvs (limit 4) ne contient
  // pas forcément ce groupe.
  let heroMvImage: string | null = null
  let heroMvFallback: string | null = null
  if (nextDrop?.groups?.slug) {
    const [latestMv] = await getGroupMvs(nextDrop.groups.slug, 1)
    const videoId = latestMv ? extractYouTubeId(latestMv.source_url) : null
    // maxres n'existe pas pour toutes les vidéos → hqdefault en repli client.
    heroMvImage = videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : null
    heroMvFallback = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null
  }
  // Le ticker garde les lignes brutes (il déduplique déjà par texte) ; la queue
  // et la week glance reçoivent la version groupée.
  const globalGrouped = groupMusicShowEpisodes(globalEvents)
  const queueSource = merged.length > 0 ? merged : globalGrouped
  const queueEvents = (heroIdx >= 0 ? merged.filter((_, i) => i !== heroIdx) : queueSource).slice(
    0,
    8,
  )

  // Ticker global : un event par groupe, groupes les plus suivis d'abord.
  const followCounts = new Map((countRows ?? []).map((r) => [r.group_id, r.follows]))
  const tickerItems = buildTickerItems(pickTickerEvents(globalEvents, followCounts, 8))

  // Week glance : complétée par les slots hebdo synthétiques des 6 shows
  // (P0.8) — dédupliqués contre les épisodes réels GLOBAUX (pas seulement
  // suivis) : « Lineup TBA » ne doit jamais s'afficher quand le lineup est
  // déjà connu quelque part.
  const wantShows = types.length === 0 || types.includes('music_show')
  const weekBase = merged.length > 0 ? merged : globalGrouped
  // Fenêtre par défaut du générateur : [maintenant, +7 j).
  const weekSlots = wantShows ? generateShowSlots({ existing: [...dbEvents, ...globalEvents] }) : []
  const weekEvents = [...weekBase, ...weekSlots].sort((a, b) =>
    a.start_at.localeCompare(b.start_at),
  )

  return (
    <>
      {/* North-star (audit §10.2) : ouverture du calendrier perso = home
          connectée avec ≥1 follow. Dédup 1/jour côté serveur ; composant
          client monté = visite réelle (pas un prefetch). */}
      {ids.length > 0 && (
        <TrackView
          event="calendar_opened"
          props={{ surface: 'home', ...(sp.src === 'push' ? { src: 'push' } : {}) }}
        />
      )}
      {ids.length > 0 && merged.length > 0 && (
        <TrackView event="personal_calendar_ready" props={{ surface: 'home' }} />
      )}
      <Ticker items={tickerItems} />
      <div className="mx-auto w-full max-w-[1400px] px-3 py-4 md:px-4 md:py-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
            <SidebarLeft showFilters={false} />
          </aside>
          <div className="order-1 min-w-0 flex-1 space-y-3 lg:order-2">
            {/* 0 follow : la home affiche des replis globaux — le dire, et
                donner la sortie (audit UX 2026-07-04, anti-churn J0). */}
            {followedIds.size === 0 && (
              <Link
                href="/groups"
                className="border-primary/40 bg-primary/8 hover:bg-primary/12 flex items-center justify-between gap-3 rounded-lg border border-dashed px-3.5 py-3 transition-colors"
              >
                <span>
                  <span className="block text-sm font-semibold">
                    You&apos;re seeing global picks
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    Follow your groups to make this calendar yours
                  </span>
                </span>
                <span className="label-data-inline text-primary shrink-0 text-[9px]">
                  Browse groups →
                </span>
              </Link>
            )}
            {nextDrop && (
              <NextDropCard
                event={nextDrop}
                isAuthed
                isFollowing={nextDrop.group_id ? followedIds.has(nextDrop.group_id) : false}
                latestMvImage={heroMvImage}
                latestMvFallback={heroMvFallback}
                timeZone={timeZone}
              />
            )}
            {queueEvents.length > 0 && (
              <Panel>
                <PanelHeader
                  label="Upcoming queue"
                  action={{ label: 'Calendar', href: '/calendar' }}
                />
                <div className="divide-y">
                  {queueEvents.map((event) => (
                    <QueueRow key={event.id} event={event} timeZone={timeZone} />
                  ))}
                </div>
              </Panel>
            )}
            <WeekGlance events={weekEvents} timeZone={timeZone} />
            <FreshDrops mvs={freshMvs} ratings={ratings} timeZone={timeZone} />
            {/* Safari iOS hors standalone uniquement (auto-gated) — fin de scroll,
                l'user a déjà consommé sa valeur, zéro pollution du premier écran. */}
            <IosInstallHint />
          </div>
          {/* Recent comebacks + Recent discussions (retour Rudy 2026-07-03) :
              sidebar en desktop, sections empilées sous le centre en mobile. */}
          <aside className="order-3 shrink-0 lg:w-80">
            <SidebarRight />
          </aside>
        </div>
      </div>
    </>
  )
}
