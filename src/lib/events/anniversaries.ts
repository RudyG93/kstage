import { createClient } from '@/lib/supabase/server'
import { kstToUtcISO, localDayKey } from './date'
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
  is_solo: boolean
}
interface AnnivMember {
  group_id: string
  stage_name: string
  birthday: string | null
}

const normName = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')

// Un soliste est presque toujours 2 rows `members` : membre de son groupe ET
// membre de son propre groupe solo (Hwasa/MAMAMOO + solo Hwasa, Lisa/BLACKPINK
// + solo Lisa…). Même personne → un seul anniversaire (retour Rudy R8). Dédup
// par (nom normalisé + birthday), en PRÉFÉRANT la row du groupe non-solo
// (« Hwasa — 30 » est plus parlant que le « 30 » nu du groupe solo).
function dedupePersons(members: AnnivMember[], groupById: Map<string, AnnivGroup>): AnnivMember[] {
  const best = new Map<string, AnnivMember>()
  for (const m of members) {
    if (!m.birthday) continue
    const g = groupById.get(m.group_id)
    if (!g) continue
    const key = `${normName(m.stage_name)}|${m.birthday}`
    const cur = best.get(key)
    if (!cur) {
      best.set(key, m)
    } else if (groupById.get(cur.group_id)?.is_solo && !g.is_solo) {
      best.set(key, m)
    }
  }
  return [...best.values()]
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

// soliste (stage_name == nom du groupe) → âge seul ; membre → « stage — âge ».
// Plus de « turns » (Rudy : « Karina — 27 » suffit). Le nom du groupe est déjà
// affiché à côté du titre sur les cartes.
function annivTitle(stageName: string, groupName: string, age: number | null): string {
  if (stageName === groupName) return age && age > 0 ? `${age}` : 'Birthday'
  return age && age > 0 ? `${stageName} — ${age}` : `${stageName} — birthday`
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
  for (const m of dedupePersons(members, groupById)) {
    const g = groupById.get(m.group_id)!
    const md = parseMonthDay(m.birthday!)
    if (!md) continue
    const occ = nextOccurrence(md, today)
    const birthYear = yearOf(m.birthday!)
    const age = birthYear ? occ.y - birthYear : null
    push(g, occ, `anniv-bday-${m.group_id}-${m.stage_name}`, annivTitle(m.stage_name, g.name, age))
  }
  return out.sort((a, b) => a.start_at.localeCompare(b.start_at))
}

/** Anniversaires à venir pour des groupes suivis, prêts à fusionner au feed.
 * `timeZone` = fuseau du viewer : « aujourd'hui » est SON jour civil — un
 * anniversaire du 17 doit rester visible toute la journée du 17 à Paris, pas
 * disparaître à 17 h quand Séoul passe au 18 (dates pures, cf. eventDayKey). */
export async function getUpcomingAnniversaries(
  groupIds: string[],
  days = 90,
  timeZone = 'Asia/Seoul',
): Promise<UpcomingEvent[]> {
  if (groupIds.length === 0) return []
  const supabase = await createClient()
  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase
      .from('groups')
      .select(
        'id, slug, name, color_hex, image_url, image_landscape, banner_url, debut_date, is_solo',
      )
      .in('id', groupIds),
    supabase.from('members').select('group_id, stage_name, birthday').in('group_id', groupIds),
  ])
  return generateAnniversaries(groups ?? [], members ?? [], {
    todayKey: localDayKey(new Date().toISOString(), timeZone),
    days,
  })
}

/** Nombre d'anniversaires à venir (fenêtre `days`) par group_id — pour le compteur
 * « N upcoming » du bloc My groups (les anniversaires y étaient oubliés). */
export async function getUpcomingAnniversaryCountsByGroup(
  groupIds: string[],
  days = 90,
  timeZone = 'Asia/Seoul',
): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map()
  const supabase = await createClient()
  const { data: members } = await supabase
    .from('members')
    .select('group_id, birthday')
    .in('group_id', groupIds)
  const [ty, tm, td] = localDayKey(new Date().toISOString(), timeZone).split('-').map(Number)
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
    .select(
      'id, slug, name, color_hex, image_url, image_landscape, banner_url, debut_date, is_solo',
    )
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
  // Dédup soliste/membre (cf. generateAnniversaries) : une personne = un anniv.
  for (const m of dedupePersons(
    (members ?? []) as AnnivMember[],
    groupById as Map<string, AnnivGroup>,
  )) {
    const g = groupById.get(m.group_id)!
    const md = parseMonthDay(m.birthday!)
    if (!md || md.month !== month) continue
    const birthYear = yearOf(m.birthday!)
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
