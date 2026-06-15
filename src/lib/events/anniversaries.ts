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

const yearOf = (s: string) => {
  const m = /^(\d{4})/.exec(s)
  return m ? Number(m[1]) : null
}

// soliste (stage_name == nom du groupe) → titre court ; membre → on garde le
// stage_name. Libellés en anglais (l'app est en EN ; « ans » détonnait — d'autant
// plus visible depuis que les anniversaires apparaissent sur les pages groupe).
function annivTitle(stageName: string, groupName: string, age: number | null): string {
  if (stageName === groupName) return age && age > 0 ? `Turns ${age}` : 'Birthday'
  return age && age > 0 ? `${stageName} — turns ${age}` : `${stageName} — birthday`
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
    push(g, occ, `anniv-bday-${m.group_id}-${m.stage_name}`, annivTitle(m.stage_name, g.name, age))
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

/** Nombre d'anniversaires à venir (fenêtre `days`) par group_id — pour le compteur
 * « N upcoming » du bloc My groups (les anniversaires y étaient oubliés). */
export async function getUpcomingAnniversaryCountsByGroup(
  groupIds: string[],
  days = 90,
): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map()
  const supabase = await createClient()
  const { data: members } = await supabase
    .from('members')
    .select('group_id, birthday')
    .in('group_id', groupIds)
  const [ty, tm, td] = kstDayKey(new Date().toISOString()).split('-').map(Number)
  const today = { y: ty, m: tm, d: td }
  const counts = new Map<string, number>()
  for (const m of members ?? []) {
    if (!m.birthday) continue
    const md = parseMonthDay(m.birthday)
    if (!md) continue
    const occ = nextOccurrence(md, today)
    if (occ.diff < 0 || occ.diff > days) continue
    counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1)
  }
  return counts
}

/** Anniversaires (birthdays) tombant dans un mois donné — pour le calendrier.
 * `groupSlugs` filtre comme le `?group=` du calendrier ; vide = tous les groupes. */
export async function getAnniversariesForMonth({
  year,
  month,
  groupSlugs,
}: {
  year: number
  month: number
  groupSlugs?: string[]
}): Promise<UpcomingEvent[]> {
  const supabase = await createClient()
  let gq = supabase
    .from('groups')
    .select('id, slug, name, color_hex, image_url, image_landscape, banner_url, debut_date')
  if (groupSlugs && groupSlugs.length > 0) gq = gq.in('slug', groupSlugs)
  const { data: groups } = await gq
  const gids = (groups ?? []).map((g) => g.id)
  if (gids.length === 0) return []

  const { data: members } = await supabase
    .from('members')
    .select('group_id, stage_name, birthday')
    .in('group_id', gids)

  const groupById = new Map((groups ?? []).map((g) => [g.id, g]))
  const out: UpcomingEvent[] = []
  for (const m of members ?? []) {
    const g = groupById.get(m.group_id)
    if (!g || !m.birthday) continue
    const md = parseMonthDay(m.birthday)
    if (!md || md.month !== month) continue
    const birthYear = yearOf(m.birthday)
    const age = birthYear ? year - birthYear : null
    out.push({
      id: `anniv-bday-${m.group_id}-${m.stage_name}-${year}`,
      title: annivTitle(m.stage_name, g.name, age),
      type: 'anniversary',
      start_at: kstToUtcISO(year, month - 1, md.day, 0, 0),
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
  return out
}
