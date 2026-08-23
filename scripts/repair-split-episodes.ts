// Épisodes de music show coupés en deux horaires.
//
// L'heure d'un épisode était décidée par le lineup qui passait, pas par
// l'épisode : une source plus tardive déclarant une autre heure insérait ses
// groupes à CETTE heure, et la réconciliation (qui dédoublonne PAR GROUPE) ne
// voyait rien d'anormal. Le cron ne le refera plus ; ce script solde
// l'existant (2 épisodes Inkigayo au 2026-08-23).
//
//   npx tsx scripts/repair-split-episodes.ts           (revue, aucune écriture)
//   npx tsx scripts/repair-split-episodes.ts --apply   (aligne)
//
// Heure retenue : celle qui correspond au créneau hebdo officiel du show s'il
// est parmi les candidates, sinon celle qui porte le plus de stages liés (un
// stage lié est la preuve qu'une diffusion réelle a été retrouvée à cette
// heure). `show_episodes.start_at` est réaligné dessus.
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { SHOW_DESCRIPTORS, SHOW_ID_BY_TITLE } from '../src/lib/scrapers/music-shows/types'
import { kstDayKey } from '../src/lib/events/date'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())

const APPLY = process.argv.includes('--apply')

type Row = { id: string; title: string; start_at: string; stage_url: string | null }

/** « HH:MM » KST d'un instant. */
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, start_at, stage_url')
      .eq('type', 'music_show')
      .eq('hidden', false)
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
  }

  // (show, jour KST) → lignes
  const parJour = new Map<string, Row[]>()
  for (const r of rows) {
    const k = `${r.title}|${kstDayKey(r.start_at)}`
    parJour.set(k, [...(parJour.get(k) ?? []), r])
  }

  let episodes = 0
  let lignes = 0
  for (const [k, list] of parJour) {
    const horaires = [...new Set(list.map((r) => r.start_at))]
    if (horaires.length < 2) continue
    const [title, jour] = k.split('|')
    const showId = SHOW_ID_BY_TITLE[title]
    const slot = SHOW_DESCRIPTORS.find((s) => s.id === showId)?.slot
    const attendu = slot
      ? `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`
      : null

    const parHoraire = horaires.map((h) => ({
      iso: h,
      hhmm: hhmm(h),
      n: list.filter((r) => r.start_at === h).length,
      stages: list.filter((r) => r.start_at === h && r.stage_url).length,
    }))
    const officiel = attendu ? parHoraire.find((c) => c.hhmm === attendu) : undefined
    const retenu = officiel ?? [...parHoraire].sort((a, b) => b.stages - a.stages || b.n - a.n)[0]

    episodes++
    const aDeplacer = list.filter((r) => r.start_at !== retenu.iso)
    lignes += aDeplacer.length
    console.log(`\n${title} — ${jour}  (créneau officiel ${attendu ?? '?'})`)
    for (const c of parHoraire) {
      const marque = c.iso === retenu.iso ? '  ← retenu' : ''
      console.log(`   ${c.hhmm}  ${c.n} lignes, ${c.stages} avec stage${marque}`)
    }

    if (!APPLY) continue
    const { error } = await supabase
      .from('events')
      .update({ start_at: retenu.iso })
      .in(
        'id',
        aDeplacer.map((r) => r.id),
      )
    if (error) throw new Error(error.message)
    const { error: epErr } = await supabase
      .from('show_episodes')
      .update({ start_at: retenu.iso })
      .eq('show_title', title)
      .eq('kst_day', jour)
    if (epErr) throw new Error(epErr.message)
  }

  console.log(`\n${episodes} épisode(s) coupé(s) en deux, ${lignes} ligne(s) à réaligner`)
  if (!APPLY && episodes > 0) console.log('(revue seule — relancer avec --apply pour aligner)')
}

main()
