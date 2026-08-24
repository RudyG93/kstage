// Alias hangul manquants — le préalable au marquage des passages non diffusés.
//
// 130 groupes sur 268 n'ont AUCUN alias hangul. Les chaînes KBS / SBS / MBC
// titrent en coréen : sans alias, la vidéo qui prouve le passage ne matche
// pas, et le groupe passe pour « annoncé mais jamais diffusé ». C'est déjà
// visible — 23 des 30 passages actuellement « non confirmés » concernent des
// groupes à `name_aliases = []` (MADEIN ×5, Oh My Girl ×4). Étiqueter avant de
// combler ce trou reviendrait à marquer « non diffusé » des passages réels.
//
// Deux sources, parce qu'aucune ne suffit (mesuré sur 9 groupes) : fandom
// porte MADEIN, POW, ARTMS, Kep1er ; MusicBrainz porte Oh My Girl, ASTRO,
// PENTAGON, WHIB. Fandom d'abord (gratuit, sans throttle imposé), MusicBrainz
// en repli.
//
//   npx tsx scripts/roster/backfill-hangul-aliases.ts            (revue)
//   npx tsx scripts/roster/backfill-hangul-aliases.ts --apply
//   npx tsx scripts/roster/backfill-hangul-aliases.ts --apply --limit=20
//
// Idempotent : n'ajoute qu'aux groupes sans alias hangul, et n'écrase jamais
// les alias existants.
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { detectInfoboxKind, field, isUsableAlias } from '../../src/lib/scrapers/debuts/fandom'
import type { Database } from '../../src/types/database'

loadEnvConfig(process.cwd())

const APPLY = process.argv.includes('--apply')
const LIMITE = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0)

const UA = 'KStage/1.0 (https://kstage.app)'
const HANGUL = /[가-힣]/
/** MusicBrainz impose 1 req/s ; fandom est libre mais on reste poli. */
const PAUSE_FANDOM_MS = 200
const PAUSE_MB_MS = 1100

const dors = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Un alias exploitable est du hangul PUR : MusicBrainz rend « 에일리 (Ailee) »,
 * dont la parenthèse latine ne matchera jamais un titre de diffuseur. On coupe
 * la parenthèse, puis on refuse tout ce qui garde une lettre latine — ces alias
 * servent un matching en SOUS-CHAÎNE, où un parasite attribue au groupe tout
 * titre qui le contient.
 */
function alias0k(v: string | null | undefined): string | null {
  const s = (v ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (!s || !HANGUL.test(s) || /[a-z]/i.test(s) || !isUsableAlias(s)) return null
  return s
}

/** Champ `hangul` / `korean` de l'infobox fandom, si la page est bien un groupe. */
async function hangulFandom(nom: string): Promise<string | null> {
  const url = `https://kpop.fandom.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=${encodeURIComponent(nom)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  const json = (await res.json()) as {
    query?: { pages?: Record<string, { revisions?: [{ slots?: { main?: { '*'?: string } } }] }> }
  }
  const pages = json.query?.pages ?? {}
  const page = Object.values(pages)[0]
  const wt = page?.revisions?.[0]?.slots?.main?.['*']
  if (!wt) return null
  // Une page membre ou une chanson porterait un hangul qui n'est pas celui du
  // groupe — on n'accepte que l'infobox groupe.
  if (detectInfoboxKind(wt) !== 'group') return null
  return alias0k(field(wt, 'hangul')) ?? alias0k(field(wt, 'korean'))
}

/**
 * sort-name ou alias hangul d'un match MusicBrainz confiant (score ≥ 90).
 * Lève sur échec réseau/rate-limit : un 503 avalé ferait passer un groupe
 * trouvable pour introuvable — c'est ce qui avait fait rater Oh My Girl au
 * premier passage, alors que MusicBrainz porte bien 오마이걸.
 */
async function hangulMusicBrainz(nom: string): Promise<string | null> {
  const url = `https://musicbrainz.org/ws/2/artist?query=artist:${encodeURIComponent(`"${nom}"`)}&fmt=json&limit=3`
  let res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 503 || res.status === 429) {
    await dors(3000)
    res = await fetch(url, { headers: { 'User-Agent': UA } })
  }
  if (!res.ok) throw new Error(`musicbrainz ${res.status} sur « ${nom} »`)
  const json = (await res.json()) as {
    artists?: {
      score: number
      name: string
      'sort-name'?: string
      aliases?: { name: string }[]
    }[]
  }
  const cible = nom.toLowerCase().replace(/[\s\-_.']/g, '')
  for (const a of json.artists ?? []) {
    if (a.score < 90) continue
    if (a.name.toLowerCase().replace(/[\s\-_.']/g, '') !== cible) continue
    const candidats = [a['sort-name'], ...(a.aliases ?? []).map((x) => x.name)]
      .map(alias0k)
      .filter((x): x is string => x !== null)
    const distincts = [...new Set(candidats)]
    // Plusieurs graphies hangul = souvent un ANCIEN nom mêlé au nom courant
    // (« Baby DONT Cry » rend 피걸즈 = P Girls ET 베이비 돈 크라이). Rien ne
    // permet de trancher automatiquement : on refuse plutôt que de deviner.
    if (distincts.length === 1) return distincts[0]
    if (distincts.length > 1) return null
  }
  return null
}

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const groupes: { id: string; slug: string; name: string; aliases: string[] }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('groups')
      .select('id, slug, name, name_aliases')
      .order('slug')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const g of data ?? []) {
      const aliases = (g.name_aliases ?? []) as string[]
      if (aliases.some((a) => HANGUL.test(a))) continue
      groupes.push({ id: g.id, slug: g.slug, name: g.name, aliases })
    }
    if (!data || data.length < 1000) break
  }

  const cible = LIMITE > 0 ? groupes.slice(0, LIMITE) : groupes
  console.log(
    `${groupes.length} groupe(s) sans alias hangul${LIMITE ? ` — on en traite ${cible.length}` : ''}\n`,
  )

  let parFandom = 0
  let parMb = 0
  let ecrits = 0
  const introuvables: string[] = []
  const echecs: string[] = []

  for (const [i, g] of cible.entries()) {
    let hangul = await hangulFandom(g.name).catch(() => null)
    let source = 'fandom'
    await dors(PAUSE_FANDOM_MS)
    if (!hangul) {
      try {
        hangul = await hangulMusicBrainz(g.name)
      } catch (e) {
        echecs.push(`${g.name}: ${String(e)}`)
      }
      source = 'musicbrainz'
      await dors(PAUSE_MB_MS)
    }

    if (!hangul) {
      introuvables.push(g.name)
      continue
    }
    if (source === 'fandom') parFandom++
    else parMb++
    console.log(`  ${g.name.padEnd(24)} ${hangul.padEnd(14)} (${source})`)

    if (APPLY) {
      const { error } = await supabase
        .from('groups')
        .update({ name_aliases: [...g.aliases, hangul] })
        .eq('id', g.id)
      if (error) console.error(`    ! ${g.slug}: ${error.message}`)
      else ecrits++
    }
    if ((i + 1) % 25 === 0) console.log(`  … ${i + 1}/${cible.length}`)
  }

  console.log(
    `\n${parFandom + parMb}/${cible.length} trouvés — ${parFandom} fandom, ${parMb} musicbrainz${APPLY ? `, ${ecrits} écrits` : ''}`,
  )
  if (echecs.length)
    console.error(
      `\n${echecs.length} échec(s) réseau — ces groupes n'ont PAS été testés :\n  ${echecs.join('\n  ')}`,
    )
  if (introuvables.length)
    console.log(`\nSans hangul (${introuvables.length}) :\n  ${introuvables.join(', ')}`)
  if (!APPLY) console.log('\n(revue seule — relancer avec --apply pour écrire)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
