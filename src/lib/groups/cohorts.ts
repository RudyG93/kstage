import { unstable_cache } from 'next/cache'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Cohortes de DEBUT — la seule dimension riche du roster qu'aucune surface
 * n'exploite : 217 groupes sur 260 portent une `debut_date`, contre 52 follows
 * et 2 notes en base (mesuré le 2026-08-22). Un rail « most followed » dirait
 * le goût de 3 comptes ; une cohorte de debut dit quelque chose de vrai.
 */
export interface CohortGroup {
  id: string
  slug: string
  name: string
  image_url: string | null
  is_solo: boolean
  debut_date: string
}

/**
 * « MAR 2024 » — `debut_date` est une DATE PURE : on l'ancre à minuit UTC et on
 * la formate en UTC. Sans les deux, un fuseau à l'ouest de Greenwich reculerait
 * la date d'un jour, et un debut du 1er du mois s'afficherait dans le mois
 * précédent.
 */
export function monthYear(date: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date.slice(0, 10)}T00:00:00Z`))
    .toUpperCase()
}

const FIELDS = 'id, slug, name, image_url, is_solo, debut_date'
/** En dessous, le bloc ne vaut pas la place qu'il prend. */
const MIN_PEERS = 3

type Row = CohortGroup

/** Actifs et publiables uniquement — un `candidate` n'a pas de page fiable. */
function baseQuery(supabase: ReturnType<typeof createAnonClient<Database>>) {
  return supabase
    .from('groups')
    .select(FIELDS)
    .neq('confidence', 'candidate')
    .is('disbanded_on', null)
    .not('debut_date', 'is', null)
}

function anon() {
  return createAnonClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export interface DebutClass {
  /** « Debut class of 2023 » (année exacte) ou « Debuted around 2013 ». */
  exactYear: boolean
  year: number
  groups: CohortGroup[]
}

/**
 * Les autres groupes de la même promotion.
 *
 * Le roster penche vers le récent (2023-2026 = 147 des 215 actifs datés), donc
 * l'année exacte suffit presque toujours. Pour les vétérans elle est vide ou
 * quasi (2013 : 1 groupe) — on élargit alors à ±2 ans plutôt que de rendre
 * `null`, sinon le bloc rejouerait le sort de « Recent discussions » : présent
 * dans le code, absent de l'écran.
 */
export const getDebutClassCached = unstable_cache(
  async (debutDate: string, excludeId: string, limit = 6): Promise<DebutClass | null> => {
    const year = Number(debutDate.slice(0, 4))
    if (!Number.isFinite(year)) return null
    const { data } = await baseQuery(anon())
      .gte('debut_date', `${year - 2}-01-01`)
      .lte('debut_date', `${year + 2}-12-31`)
      .neq('id', excludeId)
      .order('debut_date', { ascending: false })
    const window = (data ?? []) as Row[]
    const sameYear = window.filter((g) => g.debut_date.startsWith(String(year)))
    const exactYear = sameYear.length >= MIN_PEERS
    // Élargi : trier par ÉCART à l'année de référence, pas par date. Trié par
    // date, « Debuted around 2013 » ne montrait que des groupes de 2015 — le
    // bord le plus récent de la fenêtre, jamais les vrais contemporains.
    const pool = exactYear
      ? sameYear
      : [...window].sort(
          (a, b) =>
            Math.abs(Number(a.debut_date.slice(0, 4)) - year) -
              Math.abs(Number(b.debut_date.slice(0, 4)) - year) ||
            b.debut_date.localeCompare(a.debut_date),
        )
    if (pool.length < MIN_PEERS) return null
    return { exactYear, year, groups: pool.slice(0, limit) }
  },
  ['debut-class'],
  { revalidate: 86_400, tags: ['groups'] },
)

/**
 * Debuts des 12 derniers mois — 41 groupes au moment de l'écriture, et la
 * fenêtre glisse toute seule à mesure que le scraping de debuts tourne.
 */
export const getRookiesCached = unstable_cache(
  async (limit = 6): Promise<CohortGroup[]> => {
    const since = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await baseQuery(anon())
      .gte('debut_date', since)
      .lte('debut_date', today)
      .order('debut_date', { ascending: false })
      .limit(limit)
    return (data ?? []) as Row[]
  },
  ['groups-rookies'],
  { revalidate: 86_400, tags: ['groups'] },
)
