import Link from 'next/link'
import Image from 'next/image'
import { ExternalLink } from 'lucide-react'
import { Countdown } from '@/components/home/countdown'
import { eventDDay, eventDayKey, kstTime24h, isTimeTBA } from '@/lib/events/date'
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS, eventTypeTint } from '@/lib/events/labels'
import { displayEventTitle } from '@/lib/events/title'
import { eventHref, isExternalHref } from '@/lib/events/href'
import { lineupLabel, type GroupedUpcomingEvent } from '@/lib/events/grouping'
import { isSyntheticSlot } from '@/lib/events/show-slots'
import { SHOW_ICON_BY_TITLE } from '@/lib/scrapers/music-shows/types'
import { faceCrop } from '@/lib/images/cloudinary'
import { LocalTime } from '@/components/local-time'

// Ligne dense de queue (Data Desk §7.1.4) : border-left couleur type, colonne
// D-day, tag type, titre + sous-titre, heure KST. Partagée par home, calendar,
// fiche groupe et search. Hauteur de contenu 40px + padding → hit ≥44px.
export function QueueRow({
  event,
  timeZone,
  showThumb = false,
  withCountdown = false,
  lineupDisplay = 'truncate',
}: {
  event: GroupedUpcomingEvent
  // Fuseau du viewer — REQUIS : un défaut KST silencieux a déjà produit des
  // D-day KST à côté d'une grille en fuseau viewer (bug du 2026-07-17).
  timeZone: string
  showThumb?: boolean
  // Countdown inline « in 07:22:14 » (teal) pour les events du soir (§7.2).
  withCountdown?: boolean
  // 'full' : lineup complet multi-ligne (liste de jour du calendrier = la
  // fiche épisode de facto) ; 'truncate' : « A, B, C & N more » (home, search).
  lineupDisplay?: 'truncate' | 'full'
}) {
  const color = EVENT_TYPE_COLORS[event.type]
  const group = event.groups
  // Épisode groupé (music show multi-groupes, cf. groupMusicShowEpisodes) :
  // le seul « lieu » commun au lineup est le jour dans le calendrier — jamais
  // la page d'un groupe arbitraire.
  const lineup = event.lineup && event.lineup.length >= 2 ? event.lineup : null
  // Slot synthétique (show-slots.ts) : pas de groupe → son « lieu » est le
  // jour dans le calendrier, comme un épisode groupé.
  const slot = isSyntheticSlot(event)
  const dayKey = lineup || slot ? eventDayKey(event, timeZone) : null
  const href = dayKey ? `/calendar?month=${dayKey.slice(0, 7)}&day=${dayKey}` : eventHref(event)
  const external = isExternalHref(href)
  const dday = eventDDay(event, timeZone)
  // Anniversaire = date pure : aucune heure à afficher (le « 00:00 KST » de
  // l'ancrage technique n'est pas une heure d'événement).
  const allDay = event.type === 'anniversary'

  return (
    <Link
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="hover:bg-secondary/60 focus-visible:ring-primary/40 flex min-h-[44px] items-center gap-2.5 border-l-2 py-1.5 pr-3 pl-2.5 transition-colors outline-none focus-visible:ring-2"
      style={{ borderLeftColor: color }}
    >
      <span className="tabular w-[38px] shrink-0 text-xs font-bold" style={{ color }}>
        {dday}
      </span>
      {showThumb &&
        (!lineup && group?.image_url ? (
          <Image
            src={faceCrop(group.image_url, 80, 80)}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="size-10 shrink-0 rounded-[7px] object-cover"
            aria-hidden
          />
        ) : (lineup || slot) && SHOW_ICON_BY_TITLE[event.title] ? (
          // Épisode/slot de music show : avatar de la chaîne officielle du
          // diffuseur (R5) — plus parlant que l'initiale.
          <Image
            src={SHOW_ICON_BY_TITLE[event.title]}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="size-10 shrink-0 rounded-[7px] object-cover"
            aria-hidden
          />
        ) : (
          <span
            className="gradient-signature flex size-10 shrink-0 items-center justify-center rounded-[7px] text-sm font-bold text-white"
            aria-hidden
          >
            {/* Groupé/slot sans icône connue : initiale du show. */}
            {lineup || slot ? event.title[0] : (group?.name?.[0] ?? '?')}
          </span>
        ))}
      <span
        className="label-data-inline shrink-0 rounded-sm px-1.5 py-1 text-[9px]"
        style={{ color, backgroundColor: eventTypeTint(color) }}
      >
        {EVENT_TYPE_LABELS[event.type]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">
          {displayEventTitle(
            event.title,
            lineup ? undefined : group?.name,
            event.episode_number,
            event.type,
          )}
        </span>
        {lineup ? (
          lineupDisplay === 'full' ? (
            <span className="text-muted-foreground block text-[10px] leading-relaxed whitespace-normal">
              {lineup.map((e) => e.groups?.name ?? '?').join(', ')}
            </span>
          ) : (
            <span className="text-muted-foreground block truncate text-[10px]">
              {lineupLabel(lineup.map((e) => e.groups?.name ?? '?'))}
            </span>
          )
        ) : slot ? (
          <span className="text-muted-foreground block truncate text-[10px]">Lineup TBA</span>
        ) : (
          group?.name && (
            <span className="text-muted-foreground block truncate text-[10px]">{group.name}</span>
          )
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        {/* Heure LOCALE en avant (R5), KST en référence dessous — aligné sur
            event-card (décision « heure locale en avant »). */}
        {allDay ? null : isTimeTBA(event) ? (
          <span className="tabular text-muted-foreground text-[10px]">Time TBA</span>
        ) : (
          <>
            <span className="tabular text-muted-foreground flex items-center gap-1 text-[10px]">
              <LocalTime iso={event.start_at} withZone={false} fallback="—" />
              {/* La ligne ouvre YouTube dans un nouvel onglet (stage d'un music
                  show) : l'user doit le voir avant de cliquer (audit UX 2026-07-04). */}
              {external && (
                <ExternalLink className="text-faint size-3" aria-label="Opens YouTube" />
              )}
            </span>
            <span className="tabular text-muted-foreground/70 text-[10px]">
              {kstTime24h(event.start_at)} KST
            </span>
          </>
        )}
        {withCountdown && dday === 'D-DAY' && !allDay && !isTimeTBA(event) && (
          <Countdown targetIso={event.start_at} variant="inline" />
        )}
      </span>
    </Link>
  )
}
