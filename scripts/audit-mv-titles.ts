// Repasse TOUS les events type='mv' visibles au filtre de titre courant.
//
// Un MV en base que `isOfficialMvTitle` rejette est un résidu : il a été
// ingéré par une version antérieure du gate. La règle du projet est que
// chaque renforcement du filtre doit s'accompagner du nettoyage de ce qu'il
// vient de rendre invalide — sinon la page publique garde les faux positifs.
//
//   npx tsx scripts/audit-mv-titles.ts            (revue, aucune écriture)
//   npx tsx scripts/audit-mv-titles.ts --hide     (masque les rejetés)
//
// `hidden = true` plutôt que DELETE : réversible, auditable, et la clé
// d'idempotence du scraper empêche déjà la ré-insertion.
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { isOfficialMvTitle } from '../src/lib/scrapers/is-official-mv'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())

const HIDE = process.argv.includes('--hide')

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const rows: { id: string; title: string; grp: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, hidden, groups!inner(name)')
      .eq('type', 'mv')
      .eq('hidden', false)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const e of data) {
      rows.push({ id: e.id, title: e.title, grp: (e.groups as { name: string }).name })
    }
    if (data.length < 1000) break
  }

  const rejected = rows
    .map((r) => ({ r, c: isOfficialMvTitle(r.title) }))
    .filter((x) => !x.c.official)
  console.log(`${rows.length} MV visibles — ${rejected.length} rejetés par le filtre courant`)

  const byReason = new Map<string, typeof rejected>()
  for (const x of rejected) byReason.set(x.c.reason, [...(byReason.get(x.c.reason) ?? []), x])
  for (const [reason, list] of [...byReason.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n### ${reason} — ${list.length}`)
    for (const x of list) console.log(`   ${x.r.grp} | ${x.r.title.slice(0, 100)}`)
  }

  if (!HIDE || rejected.length === 0) {
    if (!HIDE) console.log('\n(revue seule — relancer avec --hide pour appliquer)')
    return
  }
  const ids = rejected.map((x) => x.r.id)
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase
      .from('events')
      .update({ hidden: true })
      .in('id', ids.slice(i, i + 100))
    if (error) throw new Error(error.message)
  }
  console.log(`\n${ids.length} events masqués (hidden = true).`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
