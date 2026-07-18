// Seed de groups.name_aliases (migration 0061, round 2026-07-18) : variantes
// de nom rencontrées dans les titres des chaînes broadcasters et les lineups —
// hangul officiel du groupe, formes longues, et « membre facturé » quand un
// slot de music show est crédité au groupe mais performé par un membre solo
// (« Ice Cream - 연준 » = slot TXT du Music Bank 1295).
//
// Idempotent : REMPLACE la liste par la valeur canonique du map (source de
// vérité = ce fichier). Slug absent en DB → warning, jamais d'erreur.
//
//   npx tsx scripts/seed-group-aliases.ts
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())

// slug DB → aliases. Hangul vérifiés (noms officiels de fandom coréen).
const ALIASES: Record<string, string[]> = {
  // Cas prouvés du Music Bank 1295 (2026-07-17)
  sunmi: ['선미'],
  monstax: ['몬스타엑스', '기현'], // 기현 = Kihyun, facturé solo sur le slot MONSTA X
  txt: ['투모로우바이투게더', 'TOMORROW X TOGETHER', '연준'], // 연준 = Yeonjun
  // Majors récurrents des lineups
  aespa: ['에스파'],
  ive: ['아이브'],
  newjeans: ['뉴진스'],
  lesserafim: ['르세라핌'],
  seventeen: ['세븐틴'],
  straykids: ['스트레이 키즈'],
  twice: ['트와이스'],
  itzy: ['있지'],
  nmixx: ['엔믹스'],
  bts: ['방탄소년단'],
  blackpink: ['블랙핑크'],
  enhypen: ['엔하이픈'],
  riize: ['라이즈'],
  nct127: ['엔시티 127'],
  nctdream: ['엔시티 드림'],
  idle: ['아이들', '여자아이들'],
  kissoflife: ['키스오브라이프'],
  zerobaseone: ['제로베이스원', 'ZB1'],
  boynextdoor: ['보이넥스트도어'],
  illit: ['아일릿'],
  redvelvet: ['레드벨벳'],
  dreamcatcher: ['드림캐쳐'],
  mamamoo: ['마마무'],
  hearts2hearts: ['하츠투하츠'],
  babymonster: ['베이비몬스터'],
  stayc: ['스테이씨'],
  viviz: ['비비지'],
  fromis9: ['프로미스나인'],
  billlie: ['빌리'],
  triples: ['트리플에스'],
  shinee: ['샤이니'],
  exo: ['엑소'],
  ateez: ['에이티즈'],
  plave: ['플레이브'],
  kickflip: ['킥플립'],
  izna: ['이즈나'],
}

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  let updated = 0
  for (const [slug, aliases] of Object.entries(ALIASES)) {
    const { data, error } = await supabase
      .from('groups')
      .update({ name_aliases: aliases })
      .eq('slug', slug)
      .select('slug')
    if (error) {
      console.error(`✗ ${slug}: ${error.message}`)
      continue
    }
    if (!data || data.length === 0) {
      console.warn(`⚠ slug absent en DB: ${slug}`)
      continue
    }
    updated++
  }
  console.log(`${updated}/${Object.keys(ALIASES).length} groupes seedés`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
