/**
 * Ajoute des SOLISTES (H/F) : candidats notables → filtre fans Deezer (≥MIN_FANS)
 * → insérés comme "groupe" à 1 membre (slug = nom normalisé), birthday récupéré
 * depuis dbkpop all-idols (match par stage name). Dry-run ; `--write` insère.
 *
 *   npx tsx scripts/roster/seed-soloists.ts
 *   npx tsx scripts/roster/seed-soloists.ts --write
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')
const MIN_FANS = 5_000
const IDOLS_URL = 'https://dbkpop.com/db/all-k-pop-idols/'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Solistes notables actifs (H/F). Deezer tranche par fans ; Rudy pourra élaguer.
const CANDIDATES: { name: string; gender: 'F' | 'M' }[] = [
  { name: 'IU', gender: 'F' },
  { name: 'Taeyeon', gender: 'F' },
  { name: 'Jennie', gender: 'F' },
  { name: 'Lisa', gender: 'F' },
  { name: 'Rosé', gender: 'F' },
  { name: 'Jisoo', gender: 'F' },
  { name: 'Hwasa', gender: 'F' },
  { name: 'Sunmi', gender: 'F' },
  { name: 'Chung Ha', gender: 'F' },
  { name: 'BIBI', gender: 'F' },
  { name: 'Heize', gender: 'F' },
  { name: 'Jeon Somi', gender: 'F' },
  { name: 'YENA', gender: 'F' },
  { name: 'Solar', gender: 'F' },
  { name: 'LEE HI', gender: 'F' },
  { name: 'AILEE', gender: 'F' },
  { name: 'Hyolyn', gender: 'F' },
  { name: 'Younha', gender: 'F' },
  { name: 'punch', gender: 'F' },
  { name: 'JAMIE', gender: 'F' },
  { name: 'Taemin', gender: 'M' },
  { name: 'BAEKHYUN', gender: 'M' },
  { name: 'KAI', gender: 'M' },
  { name: 'D.O.', gender: 'M' },
  { name: 'ZICO', gender: 'M' },
  { name: 'Crush', gender: 'M' },
  { name: 'DEAN', gender: 'M' },
  { name: 'Jackson Wang', gender: 'M' },
  { name: 'Jay Park', gender: 'M' },
  { name: 'KANG DANIEL', gender: 'M' },
  { name: 'Eric Nam', gender: 'M' },
  { name: 'Lim Young Woong', gender: 'M' },
  { name: 'Jung Kook', gender: 'M' },
  { name: 'Jimin', gender: 'M' },
  { name: 'Agust D', gender: 'M' },
  { name: 'RM', gender: 'M' },
  { name: 'j-hope', gender: 'M' },
  { name: 'V', gender: 'M' },
  { name: 'Mark Tuan', gender: 'M' },
  { name: 'pH-1', gender: 'M' },
  { name: 'Lee Mujin', gender: 'M' },
  { name: 'Colde', gender: 'M' },
  { name: 'Paul Kim', gender: 'M' },
  { name: 'Gaho', gender: 'M' },
  { name: 'BE’O', gender: 'M' },
]

interface DeezerArtist {
  name: string
  nb_fan: number
  picture_xl: string
  link: string
}

async function deezer(name: string): Promise<DeezerArtist | null> {
  let res: Response
  for (;;) {
    res = await fetch(`https://api.deezer.com/search/artist?limit=5&q=${encodeURIComponent(name)}`)
    if (res.status !== 429) break
    await sleep(2000)
  }
  if (!res.ok) return null
  const items = ((await res.json()) as { data?: DeezerArtist[] }).data ?? []
  const exact = items.filter((a) => a?.name && norm(a.name) === norm(name))
  if (exact.length) return exact.sort((a, b) => b.nb_fan - a.nb_fan)[0]
  return (
    items.find(
      (a) => a?.name && (norm(a.name).includes(norm(name)) || norm(name).includes(norm(a.name))),
    ) ?? null
  )
}

async function birthdayMap(): Promise<Map<string, string>> {
  const html = await (await fetch(IDOLS_URL, { headers: { 'User-Agent': UA } })).text()
  const $ = cheerio.load(html)
  const map = new Map<string, string>()
  $('table')
    .first()
    .find('tbody tr')
    .each((_, tr) => {
      const c = $(tr)
        .find('td')
        .map((__, td) => $(td).text().trim())
        .get()
      const dob = c[5]
      if (c[1] && /^\d{4}-\d{2}-\d{2}$/.test(dob) && !map.has(norm(c[1]))) map.set(norm(c[1]), dob)
    })
  return map
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: existing } = await supabase.from('groups').select('slug')
  const existingSlugs = new Set((existing ?? []).map((g) => g.slug))

  console.log('Fetching dbkpop birthdays + Deezer fans…')
  const bday = await birthdayMap()

  const kept: {
    name: string
    gender: string
    slug: string
    fans: number
    image: string | null
    birthday: string | null
  }[] = []
  const dropped: string[] = []
  for (const c of CANDIDATES) {
    const a = await deezer(c.name)
    const fans = a?.nb_fan ?? 0
    if (fans < MIN_FANS) {
      dropped.push(`${c.name}(${Math.round(fans / 1000)}k)`)
      await sleep(150)
      continue
    }
    kept.push({
      name: c.name,
      gender: c.gender,
      slug: norm(c.name),
      fans,
      image: a?.picture_xl ?? null,
      birthday: bday.get(norm(c.name)) ?? null,
    })
    await sleep(150)
  }
  kept.sort((a, b) => b.fans - a.fans)

  const news = kept.filter((k) => !existingSlugs.has(k.slug))
  console.log(`\n=== ${WRITE ? 'WRITE' : 'DRY-RUN'} ===`)
  console.log(
    `Candidates: ${CANDIDATES.length} | kept (≥${MIN_FANS / 1000}k): ${kept.length} | new (not already a group): ${news.length}`,
  )
  console.log(`With birthday: ${kept.filter((k) => k.birthday).length}/${kept.length}`)
  console.log('Dropped (<5k):', dropped.join(', ') || '—')
  console.log('\nfans | G | bday | name')
  kept.forEach((k) => {
    const f = k.fans >= 1e6 ? `${(k.fans / 1e6).toFixed(2)}M` : `${Math.round(k.fans / 1e3)}k`
    console.log(
      `${f.padStart(7)} | ${k.gender} | ${(k.birthday ?? '—').padEnd(10)} | ${k.name}${existingSlugs.has(k.slug) ? ' [exists]' : ''}`,
    )
  })

  if (!WRITE) {
    console.log('\nDry-run only. Re-run with --write to insert.')
    return
  }

  let g = 0
  for (const k of news) {
    const { data: up, error } = await supabase
      .from('groups')
      .insert({ slug: k.slug, name: k.name, image_url: k.image })
      .select('id')
      .single()
    if (error) {
      console.error(`soloist ${k.slug} failed:`, error.message)
      continue
    }
    await supabase.from('members').insert({
      group_id: up.id,
      stage_name: k.name,
      birthday: k.birthday,
      position: 'Soloist',
    })
    g++
  }
  console.log(`\nDone. Soloists inserted: ${g}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
