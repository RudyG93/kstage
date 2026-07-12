// Mapping domaine → IcsEvent[] — logique pure, testée. La route fournit les
// rows (superset d'UpcomingEvent avec end_at/created_at) et les anniversaires
// générés ; on produit le VCALENDAR complet.
//
// Music shows : mêmes règles que l'affichage in-app (groupMusicShowEpisodes) —
// 1 VEVENT par épisode pré-diffusion ; post-enrichissement stage-links les
// lignes portent chacune leur stage YouTube et restent individuelles (miroir
// exact du feed in-app, assumé).

import { kstDayKey } from '@/lib/events/date'
import { displayEventTitle } from '@/lib/events/title'
import { eventHref } from '@/lib/events/href'
import { groupMusicShowEpisodes, lineupLabel } from '@/lib/events/grouping'
import { EVENT_TYPE_LABELS } from '@/lib/events/labels'
import { slugify } from '@/lib/events/slug'
import type { UpcomingEvent } from '@/lib/events/queries'
import { buildIcsCalendar, icsDateTimeUtc, type IcsEvent } from './build'

export type FeedEventRow = UpcomingEvent & {
  end_at?: string | null
  created_at?: string | null
}

const HOUR_MS = 60 * 60 * 1000

/** 'YYYY-MM-DD' + n jours (UTC-safe). */
function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

function absoluteUrl(href: string, siteUrl: string): string {
  return href.startsWith('/') ? `${siteUrl}${href}` : href
}

export function buildCalendarFeed(input: {
  events: readonly FeedEventRow[]
  anniversaries: readonly UpcomingEvent[]
  siteUrl: string
}): string {
  const icsEvents: IcsEvent[] = []

  for (const e of groupMusicShowEpisodes(input.events)) {
    const row = e as FeedEventRow
    const lineup = e.lineup && e.lineup.length >= 2 ? e.lineup : null
    const title = displayEventTitle(
      e.title,
      lineup ? undefined : e.groups?.name,
      e.episode_number,
      e.type,
    )
    // UID d'un épisode fusionné : la clé de fusion (title|start), PAS l'id du
    // représentant — il churnerait avec les follows de l'user.
    const uid = lineup
      ? `mshow-${slugify(e.title)}-${icsDateTimeUtc(e.start_at)}@kstage`
      : `${e.id}@kstage`
    const summary = lineup
      ? `${title} — ${lineupLabel(lineup.map((l) => l.groups?.name ?? '?'))}`
      : `${e.groups?.name ?? 'K-pop'} — ${title}`
    const startMs = new Date(e.start_at).getTime()
    icsEvents.push({
      uid,
      summary,
      start: { kind: 'datetime', iso: e.start_at },
      // Pas de durée fiable en DB → bloc d'1 h, lisible en grille calendrier.
      end: {
        kind: 'datetime',
        iso: row.end_at ?? new Date(startMs + HOUR_MS).toISOString(),
      },
      description: `${EVENT_TYPE_LABELS[e.type] ?? e.type} · via KStage`,
      url: absoluteUrl(lineup ? '/calendar' : eventHref(e), input.siteUrl),
      dtstampIso: row.created_at ?? e.start_at,
    })
  }

  for (const a of input.anniversaries) {
    // All-day sur le jour KST : en horaire, minuit KST s'afficherait la veille
    // au soir dans les fuseaux occidentaux. DTEND explicite j+1.
    const day = kstDayKey(a.start_at)
    icsEvents.push({
      // L'id généré (anniv-bday-…) n'a pas l'année → on l'ajoute, sinon
      // l'occurrence 2027 réutiliserait l'UID 2026.
      uid: `${a.id}-${day.slice(0, 4)}@kstage`,
      summary: `${a.groups?.name ?? ''} — ${a.title}`.replace(/^ — /, ''),
      start: { kind: 'date', day },
      end: { kind: 'date', day: addDays(day, 1) },
      description: 'Birthday · via KStage',
      url: absoluteUrl(eventHref(a), input.siteUrl),
      dtstampIso: a.start_at,
    })
  }

  // Ordre d'entrée conservé (queries triées par start_at) → sortie déterministe.
  return buildIcsCalendar(icsEvents, { calName: 'KStage — My groups' })
}
