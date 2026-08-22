// Rattrapage des sorties dont le titre est resté un DESCRIPTEUR DE FORMAT.
//
// kpopofficial annonce avant que le label ne révèle le nom (« NCT 127 7th Full
// Album (2026) »), puis RENOMME sa page une fois l'album titré :
// `…/nct-127-comeback-2026/` répond 301 vers `…/nct-127-blingy/`, intitulée
// « NCT 127 7th Album – BLINGY (2026) ».
//
// Le cron `scrape-comebacks` corrige ça tout seul depuis le 2026-08-22 — mais
// il ne lit que le MOIS COURANT et le suivant. Une sortie d'un mois passé reste
// donc figée : ce script va chercher la correction sur la page de l'item
// lui-même, en suivant la redirection.
//
//   npx tsx scripts/refresh-untitled-releases.ts            (revue)
//   npx tsx scripts/refresh-untitled-releases.ts --apply
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { isUntitledRelease } from '../src/lib/scrapers/comeback-ingest'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())

const APPLY = process.argv.includes('--apply')
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/** Titre canonique d'une page kpopofficial, et son URL finale après redirect. */
async function readSourceTitle(
  url: string,
): Promise<{ title: string; finalUrl: string } | { error: string }> {
  let res: Response
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
  if (!res.ok) return { error: `HTTP ${res.status}` }
  const html = await res.text()
  // og:title d'abord (jamais suffixé par le nom du site), <title> en repli.
  const og = /property="og:title"\s+content="([^"]+)"/.exec(html)?.[1]
  const t = og ?? /<title>([^<]+)<\/title>/.exec(html)?.[1]
  if (!t) return { error: 'titre introuvable' }
  return { title: decodeEntities(t.trim()), finalUrl: res.url || url }
}

/** Les titres HTML arrivent avec &#039; / &amp; — on les rend lisibles. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data, error } = await supabase
    .from('events')
    .select('id, title, start_at, source_url, groups!inner(name)')
    .eq('type', 'release')
    .eq('hidden', false)
    .order('start_at', { ascending: false })
  if (error) throw new Error(error.message)

  // Seul kpopofficial renomme ses pages : sur fandom, `source_url` pointe la
  // page du GROUPE, qui ne porte aucun titre de sortie.
  const targets = (data ?? []).filter(
    (e) => isUntitledRelease(e.title) && (e.source_url ?? '').includes('kpopofficial.com'),
  )
  console.log(`${(data ?? []).length} releases — ${targets.length} sans vrai titre (kpopofficial)`)

  let fixed = 0
  for (const e of targets) {
    const res = await readSourceTitle(e.source_url!)
    await sleep(700) // source tierce : on reste poli
    if ('error' in res) {
      console.log(`  ✗ ${e.title} — ${res.error}`)
      continue
    }
    if (isUntitledRelease(res.title)) {
      console.log(`  · ${e.title} — la source n'a toujours pas de nom`)
      continue
    }
    console.log(`  → ${e.title}\n      ${res.title}`)
    if (res.finalUrl !== e.source_url) console.log(`      url : ${res.finalUrl}`)
    fixed++
    if (!APPLY) continue
    const { error: upErr } = await supabase
      .from('events')
      .update({ title: res.title, source_url: res.finalUrl })
      .eq('id', e.id)
    if (upErr) console.error(`      ✗ update : ${upErr.message}`)
  }
  console.log(`\n${fixed} titres ${APPLY ? 'corrigés' : 'à corriger (relancer avec --apply)'}`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
