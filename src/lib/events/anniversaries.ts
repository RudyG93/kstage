import { createClient } from '@/lib/supabase/server'
import { kstToUtcISO, kstDayKey } from './date'
import type { UpcomingEvent } from './queries'

// Génère les events "anniversaire" à la volée (pas de table dédiée) :
// - anniversaire de debut des groupes,
// - anniversaire (birthday) des membres,
// pour les occurrences à venir dans une fenêtre de `days` jours.

interface AnnivGroup {
  id: string
  slug: string
  name: string
  color_hex: string | null
  image_url: string | null
  debut_date: string | null
}
interface AnnivMember {
  group_id: string
  stage_name: string
  birthday: string | null
}

function parseMonthDay(dateStr: string): { month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return null
  return { month: Number(m[2]), day: Number(m[3]) }
}

// Prochaine occurrence (mois/jour) à partir d'aujourd'hui (KST), en jours d'écart.
function nextOccurrence(
  md: { month: number; day: number },
  today: { y: number; m: number; d: number },
): { y: number; month: number; day: number; diff: number } {
  const passed = md.month < today.m || (md.month === today.m && md.day < today.d)
  const y = passed ? today.y + 1 : today.y
  const diff =
    (Date.UTC(y, md.month - 1, md.day) - Date.UTC(today.y, today.m - 1, today.d)) / 86_400_000
  return { y, month: md.month, day: md.day, diff }
}

/** Fonction pure (testable) : génère les anniversaires à venir dans la fenêtre. */
export function generateAnniversaries(
  groups: AnnivGroup[],
  members: AnnivMember[],
  opts: { todayKey: string; days: number },
): UpcomingEvent[] {
  const [ty, tm, td] = opts.todayKey.split('-').map(Number)
  const today = { y: ty, m: tm, d: td }
  const groupById = new Map(groups.map((g) => [g.id, g]))
  const out: UpcomingEvent[] = []

  const push = (
    g: AnnivGroup,
    occ: ReturnType<typeof nextOccurrence>,
    id: string,
    title: string,
  ) => {
    if (occ.diff < 0 || occ.diff > opts.days) return
    out.push({
      id,
      title,
      type: 'anniversary',
      start_at: kstToUtcISO(occ.y, occ.month - 1, occ.day, 0, 0),
      status: 'confirmed',
      groups: { slug: g.slug, name: g.name, color_hex: g.color_hex, image_url: g.image_url },
    } as UpcomingEvent)
  }

  for (const g of groups) {
    if (!g.debut_date) continue
    const md = parseMonthDay(g.debut_date)
    if (md)
      push(g, nextOccurrence(md, today), `anniv-debut-${g.id}`, `${g.name} — debut anniversary`)
  }
  for (const m of members) {
    const g = groupById.get(m.group_id)
    if (!g || !m.birthday) continue
    const md = parseMonthDay(m.birthday)
    if (md) {
      const occ = nextOccurrence(md, today)
      // soliste : stage_name == nom du groupe → on n'affiche pas "(groupe)"
      const who = m.stage_name === g.name ? g.name : `${m.stage_name} (${g.name})`
      push(g, occ, `anniv-bday-${m.group_id}-${m.stage_name}`, `${who} — birthday`)
    }
  }
  return out.sort((a, b) => a.start_at.localeCompare(b.start_at))
}

/** Anniversaires à venir pour des groupes suivis, prêts à fusionner au feed. */
export async function getUpcomingAnniversaries(
  groupIds: string[],
  days = 90,
): Promise<UpcomingEvent[]> {
  if (groupIds.length === 0) return []
  const supabase = await createClient()
  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase
      .from('groups')
      .select('id, slug, name, color_hex, image_url, debut_date')
      .in('id', groupIds),
    supabase.from('members').select('group_id, stage_name, birthday').in('group_id', groupIds),
  ])
  return generateAnniversaries(groups ?? [], members ?? [], {
    todayKey: kstDayKey(new Date().toISOString()),
    days,
  })
}
