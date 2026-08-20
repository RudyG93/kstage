import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getRecentComebacks, getRecentlyAddedEvents, getUpcomingEvents } from '@/lib/events/queries'
import { displaySongTitle } from '@/lib/events/title'
import { eventHref } from '@/lib/events/href'
import { formatDDay, relativeTime, shortDate } from '@/lib/events/date'
import { getViewerTimeZone } from '@/lib/profiles/timezone'

// Blocs événements des rails contextuels (Lot 6 peaufinage 2026-08-20) :
// le rail droit était IDENTIQUE sur toutes les pages (Recent comebacks +
// discussions) — doublon auto-référentiel sur /mvs (retour Rudy), même bloc
// répété partout (NN/g « right-rail blindness »). Chaque page compose
// désormais ses blocs ; règle : un bloc ne llie JAMAIS vers la page où il
// est rendu.

type RailEvent = {
  id: string
  title: string
  type: string
  slug: string | null
  start_at: string
  stage_url?: string | null
  groups?: { slug: string; name: string; image_url?: string | null } | null
}

function RailLine({
  event,
  image,
  meta,
}: {
  event: RailEvent
  /** Visuel de la ligne (thumbnail d'event ou avatar du groupe). */
  image: string | null
  /** Ligne méta droite (date, D-day, « added … »). */
  meta: string
}) {
  return (
    <li>
      <Link
        href={eventHref(event) as Route}
        className="hover:bg-hover -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors"
      >
        {image ? (
          <Image
            src={image}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-md object-cover"
            aria-hidden
          />
        ) : (
          <div
            className="gradient-signature flex size-12 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white"
            aria-hidden
          >
            {event.groups?.name?.[0] ?? '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {displaySongTitle(event.title, event.groups?.name)}
          </p>
          <p className="text-muted-foreground truncate text-xs">{event.groups?.name}</p>
        </div>
        <span className="tabular text-muted-foreground shrink-0 text-[11px]">{meta}</span>
      </Link>
    </li>
  )
}

/** Sorties récentes (déjà passées) — home + repli des pages détail. Ne pas
    rendre sur /mvs : son contenu central EST la liste des drops. */
export async function RecentComebacksBlock() {
  const recent = await getRecentComebacks(10)
  if (recent.length === 0) return null
  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3">
        <span className="label-data">Recent comebacks</span>
      </div>
      <ul className="space-y-1">
        {recent.map((cb) => (
          <RailLine key={cb.id} event={cb} image={cb.image_url} meta={shortDate(cb.start_at)} />
        ))}
      </ul>
      <Link
        href="/mvs"
        className="text-primary mt-3 inline-block text-xs underline-offset-2 hover:underline"
      >
        All drops →
      </Link>
    </section>
  )
}

/** Prochains drops (mv/release FUTURS) — rail /mvs : le miroir futur du
    contenu central (qui liste le passé). Sort vers /calendar, jamais /mvs. */
export async function ComingUpBlock() {
  const [events, timeZone] = await Promise.all([
    getUpcomingEvents({ types: ['mv', 'release'], limit: 8 }),
    getViewerTimeZone(),
  ])
  if (events.length === 0) return null
  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3">
        <span className="label-data">Coming up</span>
      </div>
      <ul className="space-y-1">
        {events.map((e) => (
          <RailLine
            key={e.id}
            event={e}
            image={e.groups?.image_url ?? null}
            meta={formatDDay(e.start_at, timeZone)}
          />
        ))}
      </ul>
      <Link
        href="/calendar"
        className="text-primary mt-3 inline-block text-xs underline-offset-2 hover:underline"
      >
        Full calendar →
      </Link>
    </section>
  )
}

/** Annonces fraîches (events futurs triés par date de DÉTECTION) — rail
    /calendar : la raison de revenir. Pas de lien de sortie (la page courante
    est déjà le calendrier). */
export async function JustAnnouncedBlock() {
  // Fuseau du VIEWER : la grille du calendrier juste à côté place les events
  // par jour local — une date KST ici mettrait le rail et la grille en
  // désaccord d'un jour pour tout viewer à l'ouest de Séoul (review Lot 6).
  const [events, timeZone] = await Promise.all([getRecentlyAddedEvents(8), getViewerTimeZone()])
  if (events.length === 0) return null
  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3">
        <span className="label-data">Just announced</span>
      </div>
      <ul className="space-y-1">
        {events.map((e) => (
          <RailLine
            key={e.id}
            event={e}
            image={e.groups?.image_url ?? null}
            meta={`${shortDate(e.start_at, timeZone)} · ${relativeTime(e.created_at)}`}
          />
        ))}
      </ul>
    </section>
  )
}
