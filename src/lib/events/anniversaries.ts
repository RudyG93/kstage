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
  image_landscape: string | null
  banner_url: string | null
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
      groups: {
        slug: g.slug,
        name: g.name,
        color_hex: g.color_hex,
        image_url: g.image_url,
        image_landscape: g.image_landscape,
        banner_url: g.banner_url,
      },
    } as UpcomingEvent)
  }

  const yearOf = (s: string) => {
    const m = /^(\d{4})/.exec(s)
    return m ? Number(m[1]) : null
  }

  // Note : les "Debut anniversary" ne sont volontairement plus générés (peu
  // d'intérêt côté commu k-pop). On garde `groups.debut_date` en DB pour des
  // stats futures, mais on ne pollue plus le flux d'events avec ça.
  for (const m of members) {
    const g = groupById.get(m.group_id)
    if (!g || !m.birthday) continue
    const md = parseMonthDay(m.birthday)
    if (!md) continue
    const occ = nextOccurrence(md, today)
    const birthYear = yearOf(m.birthday)
    const age = birthYear ? occ.y - birthYear : null
    // soliste : stage_name == nom du groupe → titre court ;
    // membre : on garde le stage_name (utile, ≠ du nom du groupe affiché à gauche).
    const isSoloist = m.stage_name === g.name
    const title = isSoloist
      ? age && age > 0
        ? `${age} ans`
        : 'Birthday'
      : age && age > 0
        ? `${m.stage_name} — ${age} ans`
        : `${m.stage_name} — birthday`
    push(g, occ, `anniv-bday-${m.group_id}-${m.stage_name}`, title)
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
      .select('id, slug, name, color_hex, image_url, image_landscape, banner_url, debut_date')
      .in('id', groupIds),
    supabase.from('members').select('group_id, stage_name, birthday').in('group_id', groupIds),
  ])
  return generateAnniversaries(groups ?? [], members ?? [], {
    todayKey: kstDayKey(new Date().toISOString()),
    days,
  })
}
