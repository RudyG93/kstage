import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getRecentlyCommentedEvents, type CommentedEvent } from '@/lib/events/queries'
import { getTopRatedByPeriods } from '@/lib/events/top-rated'
import { getUpcomingAnniversaries } from '@/lib/events/anniversaries'
import { getFollowedGroupIds } from '@/lib/follows/queries'
import { getViewerTimeZone } from '@/lib/profiles/timezone'
import { displaySongTitle } from '@/lib/events/title'
import { eventHref } from '@/lib/events/href'
import { relativeTime, shortDate } from '@/lib/events/date'
import { faceCrop } from '@/lib/images/cloudinary'
import { CommentsRealtime } from '@/components/home/comments-realtime'

// Blocs communauté/perso des rails contextuels (Lot 6 peaufinage 2026-08-20).

// En dessous, un bloc communautaire est masqué (anti-ville-fantôme, règle de
// gel des features sociales).
const DISCUSSIONS_MIN = 3
const TOP_RATED_MIN = 3

function DiscussionLine({ row }: { row: CommentedEvent }) {
  const count = row.commentCount
  return (
    <li>
      <Link
        href={eventHref(row) as Route}
        className="hover:bg-hover -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors"
      >
        {row.image_url ? (
          <Image
            src={row.image_url}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-md object-cover"
            aria-hidden
          />
        ) : (
          <div
            className="gradient-signature flex size-10 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
            aria-hidden
          >
            {row.groups?.name?.[0] ?? '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {displaySongTitle(row.title, row.groups?.name)}
          </p>
          <p className="text-muted-foreground text-xs">
            {count} comment{count === 1 ? '' : 's'} · {relativeTime(row.lastCommentAt)}
          </p>
        </div>
      </Link>
    </li>
  )
}

/**
 * Fils de commentaires récents.
 *
 * `CommentsRealtime` était monté INCONDITIONNELLEMENT, y compris sous le seuil,
 * « sinon le bloc ne peut jamais apparaître en live ». Le prix mesuré le
 * 2026-08-22 : il est le seul import client de `@/lib/supabase/browser`, donc
 * il tirait **tout le client Supabase — Realtime, Phoenix, GoTrue — dans le
 * bundle de CHAQUE page** (252 Ko bruts, le plus gros chunk du build) et
 * ouvrait un websocket au chargement. Pour un bloc qui, avec 6 commentaires
 * sur 2 entités en base, ne s'affiche sur AUCUNE surface.
 *
 * Il ne s'arme donc plus qu'à partir d'une activité réelle : dès qu'une entité
 * est commentée, le live redevient utile et l'intention d'origine est
 * préservée — le bloc peut apparaître sans rechargement quand le 3ᵉ arrive.
 */
export async function DiscussionsBlock() {
  const discussions = await getRecentlyCommentedEvents(12)
  return (
    <>
      {discussions.length > 0 && <CommentsRealtime />}
      {discussions.length >= DISCUSSIONS_MIN && (
        <section className="bg-card rounded-lg border p-4">
          <div className="mb-3">
            <span className="label-data">Recent discussions</span>
          </div>
          <ul className="space-y-1">
            {discussions.map((row) => (
              <DiscussionLine key={row.id} row={row} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/** MVs les mieux notés — rail home (le module notation n'y était visible
    nulle part ; le chart complet vit au centre de /mvs, jamais dupliqué ici
    en entier : top 5 + lien). */
export async function TopRatedBlock() {
  const periods = await getTopRatedByPeriods(5)
  const monthly = periods.month.length >= TOP_RATED_MIN
  const items = monthly ? periods.month : periods.alltime
  if (items.length < TOP_RATED_MIN) return null
  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3">
        <span className="label-data">{monthly ? 'Top rated this month' : 'Top rated'}</span>
      </div>
      <ol className="space-y-1">
        {items.map((item, i) => (
          <li key={item.eventId}>
            <Link
              href={(item.slug ? `/mv/${item.slug}` : '/mvs') as Route}
              className="hover:bg-hover -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
            >
              <span className="tabular text-muted-foreground w-4 shrink-0 text-[13px] font-bold">
                {i + 1}
              </span>
              {item.groupImage ? (
                <Image
                  src={faceCrop(item.groupImage, 64, 64)}
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
                  {item.groupName?.[0] ?? '?'}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">
                  {displaySongTitle(item.title, item.groupName ?? undefined)}
                </span>
                <span className="text-muted-foreground block truncate text-[10px]">
                  {item.groupName}
                </span>
              </span>
              <span className="tabular text-amber shrink-0 text-[11px] font-semibold">
                ★ {item.avg.toFixed(1)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href="/mvs"
        className="text-primary mt-3 inline-block text-xs underline-offset-2 hover:underline"
      >
        Full chart →
      </Link>
    </section>
  )
}

/** Anniversaires des 7 prochains jours parmi les groupes SUIVIS — home.
    Masqué pour les viewers sans follow (le bloc global serait du bruit :
    ~20 anniversaires/semaine sur tout le roster). */
export async function BirthdaysBlock() {
  const followedIds = await getFollowedGroupIds()
  if (followedIds.size === 0) return null
  const timeZone = await getViewerTimeZone()
  const annivs = await getUpcomingAnniversaries([...followedIds], 7, timeZone)
  if (annivs.length === 0) return null
  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3">
        <span className="label-data">Birthdays this week</span>
      </div>
      <ul className="space-y-1">
        {annivs.map((a) => (
          <li key={a.id}>
            <Link
              href={eventHref(a) as Route}
              className="hover:bg-hover -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
            >
              {a.groups?.image_url ? (
                <Image
                  src={faceCrop(a.groups.image_url, 64, 64)}
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
                  {a.groups?.name?.[0] ?? '?'}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{a.title}</span>
                <span className="text-muted-foreground block truncate text-[10px]">
                  {a.groups?.name}
                </span>
              </span>
              <span className="tabular text-muted-foreground shrink-0 text-[11px]">
                {shortDate(a.start_at)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
