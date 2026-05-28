/**
 * Dry-run roster builder (phase 3) — AUCUNE écriture DB.
 * Candidats = kpopnet (girl groups, CC0) + dbkpop boybands (boy groups, scrape) +
 * patch des débuts récents 2024-26. Enrichissement Deezer (nb_fan + image + lien),
 * filtre ≥ MIN_FANS, sortie triée pour validation.
 *
 * Lancer : npx tsx scripts/roster/build-roster.ts
 */
import * as cheerio from 'cheerio'
import { writeFileSync, mkdirSync } from 'node:fs'

const KPOPNET_URL = 'https://raw.githubusercontent.com/kpopnet/kpopnet.json/master/kpopnet.json'
const DBKPOP_BOYS_URL = 'https://dbkpop.com/db/k-pop-boybands/'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const REQ_DELAY_MS = 170
const MIN_FANS = 5_000
const DISPLAY_FLOOR = 3_000

// Faux matchs Deezer connus (homonymes non-K-pop) + groupes J-pop hors scope.
const EXCLUDE_NORMS = new Set(
  ['SIGMA', 'AKB48', 'HKT48', 'SKE48', 'NMB48'].map((s) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, ''),
  ),
)

type Gender = 'F' | 'M' | 'mixed'
interface MemberData {
  stage_name: string
  birthday: string | null
}
interface Candidate {
  name: string
  nameKo: string | null
  gender: Gender
  debut: string | null
  members: number
  withBday: number
  source: string
  memberData: MemberData[]
}

// Débuts récents (2024-26) absents des sources figées. Deezer filtrera par fans ;
// les dates sont à confirmer (source = MusicBrainz/kprofiles en automatisation suivante).
const RECENT_PATCH: { name: string; gender: Gender; debut: string }[] = [
  { name: 'BABYMONSTER', gender: 'F', debut: '2023-11-27' },
  { name: 'ILLIT', gender: 'F', debut: '2024-03-25' },
  { name: 'KISS OF LIFE', gender: 'F', debut: '2023-07-05' },
  { name: 'Hearts2Hearts', gender: 'F', debut: '2025-02-24' },
  { name: 'izna', gender: 'F', debut: '2024-11-25' },
  { name: 'MEOVV', gender: 'F', debut: '2024-09-06' },
  { name: 'KiiiKiii', gender: 'F', debut: '2025-03-24' },
  { name: 'ALLDAY PROJECT', gender: 'mixed', debut: '2025-06-23' },
  { name: 'UNIS', gender: 'F', debut: '2024-03-27' },
  { name: 'RESCENE', gender: 'F', debut: '2024-02-28' },
  { name: 'RIIZE', gender: 'M', debut: '2023-09-04' },
  { name: 'ZEROBASEONE', gender: 'M', debut: '2023-07-10' },
  { name: 'BOYNEXTDOOR', gender: 'M', debut: '2023-05-30' },
  { name: 'TWS', gender: 'M', debut: '2024-01-22' },
  { name: 'NCT WISH', gender: 'M', debut: '2024-02-21' },
  { name: 'NEXZ', gender: 'M', debut: '2024-05-20' },
  { name: 'PLAVE', gender: 'M', debut: '2023-03-12' },
  { name: '&TEAM', gender: 'M', debut: '2022-12-07' },
]

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function kpopnetGirls(): Promise<Candidate[]> {
  interface G {
    name: string
    name_original: string | null
    debut_date: string | null
    disband_date: string | null
    members: { idol_id: string }[]
  }
  interface I {
    id: string
    name: string
    birth_date: string | null
  }
  const data = (await (await fetch(KPOPNET_URL)).json()) as { groups: G[]; idols: I[] }
  const idols = new Map(data.idols.map((i) => [i.id, i]))
  return data.groups
    .filter((g) => g.disband_date === null)
    .map((g) => {
      const m = g.members.map((x) => idols.get(x.idol_id)).filter(Boolean) as I[]
      return {
        name: g.name,
        nameKo: g.name_original,
        gender: 'F' as Gender,
        debut: g.debut_date,
        members: m.length,
        withBday: m.filter((i) => i.birth_date).length,
        source: 'kpopnet',
        memberData: m.map((i) => ({ stage_name: i.name, birthday: i.birth_date })),
      }
    })
}

async function dbkpopBoys(): Promise<Candidate[]> {
  const html = await (await fetch(DBKPOP_BOYS_URL, { headers: { 'User-Agent': UA } })).text()
  const $ = cheerio.load(html)
  const out: Candidate[] = []
  $('table')
    .first()
    .find('tbody tr')
    .each((_, tr) => {
      const c = $(tr)
        .find('td')
        .map((_, td) => $(td).text().trim())
        .get()
      // [Profile, Name, Short, Korean, Debut, Company, Members, Orig, Fanclub, Active]
      const name = c[1]
      const active = c[9]
      if (!name || active !== 'Yes') return
      out.push({
        name,
        nameKo: c[3] || null,
        gender: 'M',
        debut: /^\d{4}-\d{2}-\d{2}$/.test(c[4]) ? c[4] : null,
        members: Number(c[6]) || 0,
        withBday: 0,
        source: 'dbkpop',
        memberData: [],
      })
    })
  return out
}

interface DeezerArtist {
  name: string
  nb_fan: number
  nb_album: number
  picture_xl: string
  link: string
}
async function deezer(cand: Candidate): Promise<DeezerArtist | null> {
  for (const q of [cand.name, cand.nameKo].filter(Boolean) as string[]) {
    let res: Response
    for (;;) {
      res = await fetch(`https://api.deezer.com/search/artist?limit=5&q=${encodeURIComponent(q)}`)
      if (res.status !== 429) break
      await sleep(2000)
    }
    if (!res.ok) continue
    const items = ((await res.json()) as { data?: DeezerArtist[] }).data ?? []
    const exact = items.filter((a) => a?.name && norm(a.name) === norm(cand.name))
    if (exact.length) return exact.sort((a, b) => b.nb_fan - a.nb_fan)[0]
    const loose = items.find(
      (a) =>
        a?.name &&
        (norm(a.name).includes(norm(cand.name)) || norm(cand.name).includes(norm(a.name))),
    )
    if (loose) return loose
  }
  return null
}

async function main() {
  console.log('Gathering candidates…')
  const [girls, boys] = await Promise.all([kpopnetGirls(), dbkpopBoys()])
  const recents: Candidate[] = RECENT_PATCH.map((r) => ({
    name: r.name,
    nameKo: null,
    gender: r.gender,
    debut: r.debut,
    members: 0,
    withBday: 0,
    source: 'recent-patch',
    memberData: [],
  }))
  console.log(
    `kpopnet girls: ${girls.length} | dbkpop boys: ${boys.length} | recent patch: ${recents.length}`,
  )

  // dédup par nom normalisé (priorité kpopnet > dbkpop > patch pour garder les membres)
  const byName = new Map<string, Candidate>()
  for (const c of [...girls, ...boys, ...recents]) {
    const k = norm(c.name)
    if (EXCLUDE_NORMS.has(k)) continue
    if (!byName.has(k)) byName.set(k, c)
    else {
      const ex = byName.get(k)!
      if (ex.members === 0 && c.members > 0) byName.set(k, c)
    }
  }
  const candidates = [...byName.values()]
  console.log(
    `Unique candidates: ${candidates.length}\nEnriching via Deezer @ ~${Math.round(1000 / REQ_DELAY_MS)}/s…\n`,
  )

  const rows: Array<
    Candidate & {
      fans: number
      albums: number
      imageUrl: string | null
      deezerLink: string | null
      deezerName: string | null
    }
  > = []
  let done = 0
  for (const c of candidates) {
    const a = await deezer(c)
    rows.push({
      ...c,
      fans: a?.nb_fan ?? 0,
      albums: a?.nb_album ?? 0,
      imageUrl: a?.picture_xl ?? null,
      deezerLink: a?.link ?? null,
      deezerName: a?.name ?? null,
    })
    if (++done % 40 === 0) console.log(`  …${done}/${candidates.length}`)
    await sleep(REQ_DELAY_MS)
  }

  rows.sort((a, b) => b.fans - a.fans)
  const kept = rows.filter((r) => r.fans >= MIN_FANS)
  const byGender = (g: Gender) => kept.filter((r) => r.gender === g).length
  console.log('\n========== STATS ==========')
  console.log(`Candidates: ${rows.length} | kept (≥${MIN_FANS / 1000}k fans): ${kept.length}`)
  console.log(
    `Kept by gender → F: ${byGender('F')} | M: ${byGender('M')} | mixed: ${byGender('mixed')}`,
  )
  console.log(
    `\n========== ROSTER (fans ≥ ${DISPLAY_FLOOR / 1000}k shown; ★ = below ${MIN_FANS / 1000}k threshold) ==========`,
  )
  console.log('rank | fans | G | debut | mbrs(bday) | src | name')
  rows
    .filter((r) => r.fans >= DISPLAY_FLOOR)
    .forEach((r, i) => {
      const f = r.fans >= 1e6 ? `${(r.fans / 1e6).toFixed(2)}M` : `${Math.round(r.fans / 1e3)}k`
      const mark = r.fans >= MIN_FANS ? ' ' : '★'
      const nm =
        r.deezerName && norm(r.deezerName) !== norm(r.name)
          ? `${r.name} [→${r.deezerName}]`
          : r.name
      console.log(
        `${mark}${String(i + 1).padStart(3)} | ${f.padStart(7)} | ${r.gender.padEnd(5)} | ${(r.debut ?? '—').padEnd(10)} | ${r.members}(${r.withBday}) | ${r.source.padEnd(12)} | ${nm}`,
      )
    })

  mkdirSync('scripts/roster/out', { recursive: true })
  writeFileSync('scripts/roster/out/roster-dryrun.json', JSON.stringify(kept, null, 2))
  console.log(`\nKept roster (${kept.length}) → scripts/roster/out/roster-dryrun.json`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
