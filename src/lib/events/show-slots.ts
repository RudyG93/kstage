import { SHOW_DESCRIPTORS } from '@/lib/scrapers/music-shows/types'
import { kstDayKey } from './date'
import type { UpcomingEvent } from './queries'

// Créneaux hebdo synthétiques des 6 music shows (BACKLOG P0.8, tranché
// 2026-07-11) : générés à la lecture comme les anniversaires — JAMAIS en DB.
// Les sources (carrd + broadcasters) ne publient les lineups que la veille ou
// J-2/J-3 : entre-temps le calendrier futur paraissait vide alors que la grille
// hebdo des shows est fixe et connue. Le slot s'affiche « Lineup TBA » puis
// disparaît au profit des épisodes réels dès qu'ils sont scrapés (dédup par
// (title, jour KST)). Pas de push sur du synthétique, pas d'iCal (feed perso =
// groupes suivis uniquement).

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Un slot synthétique se reconnaît à son id — utilisé par QueueRow pour le
 *  href (le « lieu » d'un slot est son jour de calendrier) et le sous-titre. */
export function isSyntheticSlot(event: { id: string }): boolean {
  return event.id.startsWith('slot-')
}

/**
 * Slots des 6 shows dans [fromIso, toIso), moins ceux couverts par un vrai
 * music_show du même show le même jour KST. La borne basse est TOUJOURS
 * clampée à maintenant (invariant interne : jamais de slot dans le passé, pas
 * de fausse histoire). Défauts : fromIso = maintenant, toIso = from + 7 j.
 * `nowMs` n'est injecté que par les tests (déterminisme) — les composants
 * serveur ne doivent pas appeler Date.now() en render (lint react purity).
 */
export function generateShowSlots(opts: {
  fromIso?: string
  toIso?: string
  existing: readonly { type: string; title: string; start_at: string }[]
  nowMs?: number
}): UpcomingEvent[] {
  const nowMs = opts.nowMs ?? Date.now()
  const fromMs = Math.max(opts.fromIso ? Date.parse(opts.fromIso) : nowMs, nowMs)
  const toMs = opts.toIso ? Date.parse(opts.toIso) : fromMs + 7 * DAY_MS
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return []

  // Jours KST couverts par un vrai épisode, par show (title = displayName).
  const covered = new Set(
    opts.existing
      .filter((e) => e.type === 'music_show')
      .map((e) => `${e.title}|${kstDayKey(e.start_at)}`),
  )

  const out: UpcomingEvent[] = []
  // Balaye les jours KST de la fenêtre (≤ ~35 itérations pour un mois).
  for (
    let dayStartKst = startOfKstDay(fromMs);
    dayStartKst < toMs + KST_OFFSET_MS;
    dayStartKst += DAY_MS
  ) {
    const kst = new Date(dayStartKst)
    const weekday = kst.getUTCDay()
    for (const show of SHOW_DESCRIPTORS) {
      if (show.slot.weekday !== weekday) continue
      const slotUtcMs =
        Date.UTC(
          kst.getUTCFullYear(),
          kst.getUTCMonth(),
          kst.getUTCDate(),
          show.slot.hour,
          show.slot.minute,
        ) - KST_OFFSET_MS
      if (slotUtcMs < fromMs || slotUtcMs >= toMs) continue
      const startAt = new Date(slotUtcMs).toISOString()
      const dayKey = kstDayKey(startAt)
      if (covered.has(`${show.displayName}|${dayKey}`)) continue
      out.push({
        id: `slot-${show.id}-${dayKey}`,
        group_id: '',
        slug: null,
        title: show.displayName,
        type: 'music_show',
        start_at: startAt,
        status: 'tentative',
        episode_number: null,
        source_url: null,
        stage_url: null,
        groups: null,
      } as unknown as UpcomingEvent)
    }
  }
  return out.sort((a, b) => a.start_at.localeCompare(b.start_at))
}

/** Minuit KST (en ms « KST-shifted » : UTC + 9h) du jour contenant `utcMs`. */
function startOfKstDay(utcMs: number): number {
  const shifted = utcMs + KST_OFFSET_MS
  return shifted - (shifted % DAY_MS)
}
