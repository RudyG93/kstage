// Membres de groupe qui ont une carrière SOLO et méritent donc leur fiche.
//
// Rudy, 2026-08-24 : « il faudra que tu étudies tous les membres de groupes qui
// ont déjà fait des solos et qui donc méritent leur page ». Le cas i-dle est le
// modèle — Yuqi avait sa fiche, Miyeon non, alors que sa sortie était déjà en
// base, rangée sur le groupe.
//
// LE SIGNAL. kpop.fandom maintient `Category:Female soloists` et
// `Category:Male soloists`, et un membre y est ajouté SUR SA PROPRE PAGE dès
// qu'il sort en solo. L'infobox porte alors `| solo_debut = `, qui est le champ
// décisif. C'est le seul signal de masse : Deezer ne sert qu'à trier, pas à
// découvrir — un soliste encore en groupe voit ses sorties créditées sous le
// groupe (Miyeon : 136 fans Deezer, contre 6 630 sous sa vraie fiche).
//
// L'APPARIEMENT se fait sur la DATE DE NAISSANCE, jamais sur le nom seul :
// « Soyeon » existe chez i-dle ET LABOUM, « Jaehyun » sur 4 rows. Deux faux
// positifs réels attrapés par cette règle lors de la mise au point —
//   Minhee (CRAVITY) → page « Kang Min Hee », né 1991-12-29, alors que le
//   Minhee de CRAVITY est né 2002-09-17 (son `solo_debut` de 2009 aurait dû
//   alerter : il avait 6 ans) ;
//   Minhyuk (MONSTA X) → page « Lee Minhyuk », né 1990-11-29, c'est-à-dire le
//   Minhyuk de BtoB, déjà dans la liste par ailleurs.
//
//   npx tsx scripts/roster/detect-soloist-members.ts              (revue)
//   npx tsx scripts/roster/detect-soloist-members.ts --json       (liste brute)
//
// READ-ONLY : ce script ne crée rien. La promotion se fait ensuite membre par
// membre via `promote-member-to-soloist.ts`, qui porte ses propres gardes.
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { field } from '../../src/lib/scrapers/debuts/fandom'
import { normalizeName } from '../../src/lib/members/matching'
import type { Database } from '../../src/types/database'

loadEnvConfig(process.cwd())

const JSON_OUT = process.argv.includes('--json')
const API = 'https://kpop.fandom.com/api.php'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
/** 50 titres par requête : le maximum de l'API MediaWiki pour les non-bots. */
const TITRES_PAR_LOT = 50

async function api<T>(params: Record<string, string>): Promise<T | null> {
  const qs = new URLSearchParams({ ...params, format: 'json' })
  const res = await fetch(`${API}?${qs}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`fandom ${res.status} — ${qs.toString().slice(0, 80)}`)
  return (await res.json()) as T
}

/** Toutes les pages d'une catégorie, paginées par cmcontinue. */
async function categorie(nom: string): Promise<string[]> {
  const titres: string[] = []
  let suite: string | undefined
  for (;;) {
    const data = await api<{
      query?: { categorymembers?: { title: string }[] }
      continue?: { cmcontinue?: string }
    }>({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${nom}`,
      cmlimit: '500',
      ...(suite ? { cmcontinue: suite } : {}),
    })
    for (const m of data?.query?.categorymembers ?? []) titres.push(m.title)
    suite = data?.continue?.cmcontinue
    if (!suite) break
  }
  return titres
}

/** Wikitexte de 50 pages en UNE requête — 1 600 pages tiennent en 32 appels. */
async function wikitextes(titres: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < titres.length; i += TITRES_PAR_LOT) {
    const lot = titres.slice(i, i + TITRES_PAR_LOT)
    const data = await api<{
      query?: {
        pages?: Record<string, { title: string; revisions?: [{ '*'?: string }] }>
      }
    }>({
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      titles: lot.join('|'),
    })
    for (const p of Object.values(data?.query?.pages ?? {})) {
      const wt = p.revisions?.[0]?.['*']
      if (wt) out.set(p.title, wt)
    }
    if (!JSON_OUT)
      process.stdout.write(
        `\r  wikitextes ${Math.min(i + TITRES_PAR_LOT, titres.length)}/${titres.length}`,
      )
  }
  if (!JSON_OUT) process.stdout.write('\n')
  return out
}

/** `{{Birth date and age|2006|10|11}}` ou `October 11, 2006` → ISO. */
function dateNaissance(raw: string | null): string | null {
  if (!raw) return null
  const tpl = raw.match(
    /\{\{\s*[Bb]irth date(?:\s+and age)?\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/,
  )
  if (tpl) return `${tpl[1]}-${tpl[2].padStart(2, '0')}-${tpl[3].padStart(2, '0')}`
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[0]
  const texte = raw.replace(/\[\[|\]\]/g, '').match(/([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})/)
  if (!texte) return null
  const mois = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ].indexOf(texte[1].toLowerCase())
  if (mois < 0) return null
  return `${texte[3]}-${String(mois + 1).padStart(2, '0')}-${texte[2].padStart(2, '0')}`
}

/** « Soyeon (LABOUM) » → « Soyeon ». Le désambiguïsateur sert au contrôle. */
function nomNu(titre: string): string {
  return titre.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Membres canoniques qui n'ont PAS déjà une fiche solo.
  const membres: {
    id: string
    slug: string | null
    nom: string
    birthday: string | null
    groupe: string
    groupeSolo: boolean
  }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('members')
      .select('id, slug, stage_name, birthday, canonical_id, groups!inner(name, is_solo)')
      .is('canonical_id', null)
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const m of data ?? []) {
      const g = m.groups as unknown as { name: string; is_solo: boolean | null }
      membres.push({
        id: m.id,
        slug: m.slug,
        nom: m.stage_name,
        birthday: m.birthday,
        groupe: g.name,
        groupeSolo: g.is_solo === true,
      })
    }
    if (!data || data.length < 1000) break
  }
  const enGroupe = membres.filter((m) => !m.groupeSolo)
  if (!JSON_OUT)
    console.log(`${enGroupe.length} membres de groupe canoniques (hors fiches solo existantes)\n`)

  const titres = [
    ...new Set([...(await categorie('Female soloists')), ...(await categorie('Male soloists'))]),
  ]
  if (!JSON_OUT) console.log(`${titres.length} pages dans les deux catégories soliste`)
  const pages = await wikitextes(titres)

  // Index des membres par date de naissance : la clé d'appariement.
  const parDate = new Map<string, typeof enGroupe>()
  for (const m of enGroupe) {
    if (!m.birthday) continue
    parDate.set(m.birthday, [...(parDate.get(m.birthday) ?? []), m])
  }

  const trouves: {
    slug: string | null
    membre: string
    groupe: string
    page: string
    soloDebut: string
    birthday: string
  }[] = []
  const sansDate: string[] = []

  for (const [titre, wt] of pages) {
    const soloDebut = field(wt, 'solo_debut')
    if (!soloDebut) continue // pas de carrière solo déclarée
    const naissance = dateNaissance(field(wt, 'birth_date'))
    if (!naissance) {
      sansDate.push(titre)
      continue
    }
    const candidats = parDate.get(naissance)
    if (!candidats || candidats.length === 0) continue
    // Date identique ET nom compatible : la date seule collisionne (deux idols
    // nés le même jour), le nom seul collisionne encore plus.
    const cible = candidats.find((c) => normalizeName(c.nom) === normalizeName(nomNu(titre)))
    if (!cible) continue
    trouves.push({
      slug: cible.slug,
      membre: cible.nom,
      groupe: cible.groupe,
      page: titre,
      soloDebut: soloDebut.replace(/\[\[|\]\]/g, '').slice(0, 40),
      birthday: naissance,
    })
  }

  trouves.sort((a, b) => a.groupe.localeCompare(b.groupe) || a.membre.localeCompare(b.membre))

  if (JSON_OUT) {
    console.log(JSON.stringify(trouves, null, 2))
    return
  }

  console.log(`\n${trouves.length} membres de groupe ont une carrière solo déclarée :\n`)
  for (const t of trouves)
    console.log(
      `  ${(t.slug ?? '(sans slug)').padEnd(28)} ${t.membre.padEnd(16)} ${t.groupe.padEnd(20)} solo ${t.soloDebut}`,
    )
  console.log(
    `\n${sansDate.length} pages avec solo_debut mais sans date de naissance exploitable — non appariables, à revoir à la main si besoin.`,
  )
  console.log(
    '\nPromotion : npx tsx scripts/roster/promote-member-to-soloist.ts --member=<slug> --apply',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
