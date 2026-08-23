import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { TrendingList, type TrendingEntry } from '@/components/group/trending-list'
import { getGroupFollowCounts, getGroupsCached, getNewestGroupsCached } from '@/lib/groups/queries'
import {
  getNextEventForAllGroupsCached,
  getRecentReleasesForAllGroupsCached,
} from '@/lib/events/queries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import {
  getDebutClassCached,
  getRookiesCached,
  monthYear,
  type CohortGroup,
} from '@/lib/groups/cohorts'
import { getPromotingGroupsCached } from '@/lib/groups/promoting'
import { pickTrending } from '@/lib/groups/trending'
import { getViewerTimeZone } from '@/lib/profiles/timezone'
import { getViewer } from '@/lib/supabase/viewer'
import { relativeTime } from '@/lib/events/date'
import { faceCrop } from '@/lib/images/cloudinary'

// Blocs découverte des rails contextuels (Lot 6 peaufinage 2026-08-20).

/** Derniers groupes/solistes ajoutés au roster — rail /groups. Met en avant
    la couverture qui grandit (les solos passent par le redirect /groups→
    /artists déjà en place). */
export async function NewGroupsBlock() {
  const newest = await getNewestGroupsCached(6)
  if (newest.length === 0) return null
  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3">
        <span className="label-data">New on KStage</span>
      </div>
      <ul className="space-y-1">
        {newest.map((g) => (
          <li key={g.id}>
            <Link
              href={`/groups/${g.slug}` as Route}
              className="hover:bg-hover -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
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
                  {g.is_solo ? 'Soloist' : 'Group'} · added {relativeTime(g.created_at)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * « On music shows » — palmarès des groupes par nombre de passages sur 30 jours.
 *
 * Répond à la demande de Rudy (un classement nourri par nos données) avec le
 * seul signal qui existe vraiment : `user_follows` ne compte que 3 comptes,
 * alors que la base porte 255 passages sur 68 groupes. C'est aussi la lecture
 * « qui promeut en ce moment », que l'app ne donne nulle part — les pages
 * groupe et artiste montrent les passages D'UN groupe, jamais le palmarès.
 *
 * À NE PAS monter sur une page qui affiche déjà des music shows au centre
 * (/calendar, /show/[show]/[day]) : le rail ne doit pas redire le centre.
 */
export async function PromotingNowBlock() {
  const groups = await getPromotingGroupsCached(6)
  if (groups.length === 0) return null
  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3">
        <span className="label-data">On music shows · 30 days</span>
      </div>
      <ul className="space-y-1">
        {groups.map((g) => (
          <li key={g.id}>
            <Link
              href={`/groups/${g.slug}` as Route}
              className="hover:bg-hover -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
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
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{g.name}</span>
              <span className="tabular text-muted-foreground shrink-0 text-[11px]">
                {g.stages} stage{g.stages === 1 ? '' : 's'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** « In the spotlight » (imminence + récence, déjà calculé pour /groups) —
    rail des pages détail groupe/artiste. `excludeSlug` écarte l'artiste de
    la page courante (règle : jamais de lien vers soi-même). */
export async function SpotlightBlock({ excludeSlug }: { excludeSlug?: string }) {
  const [{ user }, groups, followedIds, followCounts, nextEvents, recentReleases, timeZone] =
    await Promise.all([
      getViewer(),
      getGroupsCached(),
      getFollowedGroupIds(),
      getGroupFollowCounts(),
      getNextEventForAllGroupsCached(),
      getRecentReleasesForAllGroupsCached(),
      getViewerTimeZone(),
    ])
  const pool = excludeSlug ? groups.filter((g) => g.slug !== excludeSlug) : groups
  const popOf = (id: string) => followCounts.get(id) ?? 0
  // nowMs = undefined → défaut Date.now() DANS la lib (purity lint RSC).
  const trending = pickTrending(pool, nextEvents, recentReleases, popOf, 5, undefined, timeZone)
  if (trending.length === 0) return null
  const entries: TrendingEntry[] = trending.map(({ item, reason }) => ({
    group: item,
    isFollowing: followedIds.has(item.id),
    reason,
  }))
  return <TrendingList entries={entries} isAuthed={!!user} />
}

function CohortLine({ g }: { g: CohortGroup }) {
  return (
    <li>
      <Link
        href={`/groups/${g.slug}` as Route}
        className="hover:bg-hover -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
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
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{g.name}</span>
        <span className="tabular text-muted-foreground shrink-0 text-[11px]">
          {monthYear(g.debut_date)}
        </span>
      </Link>
    </li>
  )
}

/**
 * « Debut class of 2023 » — les autres groupes de la même promotion.
 *
 * Rail des pages détail groupe/artiste, à la place de « Recent discussions »
 * qui n'y rendait rien (6 commentaires en base, seuil à 3 par entité). C'est
 * le seul bloc du rail qui parle de l'artiste affiché : Spotlight, juste
 * au-dessus, tire au hasard dans tout le roster.
 */
export async function DebutClassBlock({
  debutDate,
  excludeId,
}: {
  debutDate?: string | null
  excludeId?: string | null
}) {
  if (!debutDate || !excludeId) return null
  const cohort = await getDebutClassCached(debutDate, excludeId, 6)
  if (!cohort) return null
  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3">
        <span className="label-data">
          {cohort.exactYear ? `Debut class of ${cohort.year}` : `Debuted around ${cohort.year}`}
        </span>
      </div>
      <ul className="space-y-1">
        {cohort.groups.map((g) => (
          <CohortLine key={g.id} g={g} />
        ))}
      </ul>
    </section>
  )
}

/**
 * « Rookies » — debuts des 12 derniers mois (41 groupes en base).
 *
 * Rail /calendar : la grille du mois raconte ce qui SE PASSE, jamais qui vient
 * d'arriver. Ne pas monter sur /groups, dont le rail porte déjà « New on
 * KStage » (ajouts au roster) — les deux se ressembleraient de trop près.
 */
export async function RookiesBlock() {
  const rookies = await getRookiesCached(6)
  if (rookies.length === 0) return null
  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3">
        <span className="label-data">Rookies · debuted this year</span>
      </div>
      <ul className="space-y-1">
        {rookies.map((g) => (
          <CohortLine key={g.id} g={g} />
        ))}
      </ul>
      <Link
        href="/groups"
        className="text-primary mt-3 inline-block text-xs underline-offset-2 hover:underline"
      >
        All groups →
      </Link>
    </section>
  )
}
