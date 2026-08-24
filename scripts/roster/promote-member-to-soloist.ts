// Promotion d'un membre de groupe en soliste : sa propre fiche `/artists/<slug>`.
//
// Un soliste n'est PAS « un groupe à un membre » : c'est une PERSONNE qui a
// déjà une ligne en base. On part donc du slug de sa row `members`, jamais d'un
// nom — c'est ce qui évite l'homonymie, qui est le piège dominant ici
// (« Soyeon » existe chez i-dle ET LABOUM, « Jaehyun » sur 4 rows).
//
// Le chemin passe par `createFromPayload`, qui résout le nom sur fandom et
// dégénère pour un soliste : `fetchMemberBirthday(stage_name, payload.name)` y
// est appelé avec les deux arguments égaux, si bien que le garde anti-homonyme
// rejette la page correctement désambiguïsée et retient celle de l'homonyme le
// plus célèbre. C'est ainsi que la fiche solo `jisoo` a porté `1994-02-11`
// pendant trois mois. Ici on ne devine rien : `real_name` et `birthday` sont
// RECOPIÉS de la row source.
//
//   npx tsx scripts/roster/promote-member-to-soloist.ts --member=idle-miyeon
//   npx tsx scripts/roster/promote-member-to-soloist.ts --member=idle-miyeon --apply
//   npx tsx scripts/roster/promote-member-to-soloist.ts --member=idle-miyeon \
//     --artist-slug=miyeon --apply
//
// Idempotent : relancé sur une personne déjà promue, il refuse sans rien
// écrire. Dry-run par défaut.
import { loadEnvConfig } from '@next/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSamePerson, type PersonEvidence } from '../../src/lib/members/matching'
import { mentionsArtist } from '../../src/lib/scrapers/group-match'
import { fetchMbEnrichment } from '../../src/lib/scrapers/musicbrainz'
import type { Database } from '../../src/types/database'

loadEnvConfig(process.cwd())

const APPLY = process.argv.includes('--apply')
const arg = (nom: string) =>
  process.argv
    .find((a) => a.startsWith(`--${nom}=`))
    ?.split('=')
    .slice(1)
    .join('=') ?? null

const MEMBER_SLUG = arg('member')
const ARTIST_SLUG_DEMANDE = arg('artist-slug')

/** Un nom trop court matche tout ; `ten`, `roa`, `woo` ne sont pas seedables. */
const NOM_TROP_COURT = 4

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

type Client = SupabaseClient<Database>

function refus(message: string): never {
  console.error(`REFUS — ${message}`)
  process.exit(1)
}

/** La personne à promouvoir, lue en base et jamais devinée. */
async function chargerSource(supabase: Client, slug: string) {
  const { data, error } = await supabase
    .from('members')
    .select(
      'id, slug, stage_name, real_name, birthday, photo_url, canonical_id, group_id, status, groups!inner(slug, name, agency, is_solo)',
    )
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) refus(`aucun membre de slug « ${slug} »`)
  const groupe = data.groups as unknown as {
    slug: string
    name: string
    agency: string | null
    is_solo: boolean | null
  }
  if (groupe.is_solo) refus(`« ${slug} » est déjà une fiche solo (${groupe.name})`)
  if (data.canonical_id)
    refus(`« ${slug} » n'est pas la row canonique de cette personne — promouvoir la canonique`)
  return { ...data, groupe }
}

/** Refuse si la personne a déjà une fiche solo, même sous une autre graphie. */
async function dejaSoliste(supabase: Client, source: PersonEvidence) {
  const { data, error } = await supabase
    .from('members')
    .select('id, slug, stage_name, real_name, birthday, canonical_id, group_id, groups!inner(slug)')
    .eq('position', 'Soloist')
    .is('canonical_id', null)
    .eq('groups.is_solo', true)
  if (error) throw new Error(error.message)
  return (data ?? []).find((m) => isSamePerson(source, m as PersonEvidence)) ?? null
}

async function slugLibre(supabase: Client, slug: string) {
  const [g, m] = await Promise.all([
    supabase.from('groups').select('slug').eq('slug', slug).maybeSingle(),
    supabase.from('members').select('slug').eq('slug', slug).maybeSingle(),
  ])
  if (g.error) throw new Error(g.error.message)
  if (m.error) throw new Error(m.error.message)
  return { groupe: !g.data, membre: !m.data }
}

/**
 * Events du groupe d'origine dont le TITRE nomme le membre en mot entier.
 * Mot entier et non sous-chaîne : « ten » vit dans « listen », et une sortie
 * attribuée à la mauvaise personne est bien plus coûteuse qu'une sortie
 * manquante (cf. les 3 MV de SISTAR attribués à IVE).
 */
async function eventsARecuperer(supabase: Client, groupId: string, nom: string) {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, type, start_at, member_id')
    .eq('group_id', groupId)
    .order('start_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).filter((e) => mentionsArtist(e.title, nom))
}

async function main() {
  if (!MEMBER_SLUG) refus('--member=<slug de la row members> est requis')

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const source = await chargerSource(supabase, MEMBER_SLUG)
  const artistSlug = ARTIST_SLUG_DEMANDE ?? slugify(source.stage_name)

  console.log(`Personne  : ${source.stage_name} (${source.groupe.name})`)
  console.log(`  real_name ${source.real_name ?? '—'} · birthday ${source.birthday ?? '—'}`)
  console.log(`Fiche solo : /artists/${artistSlug}`)

  const existante = await dejaSoliste(supabase, source as PersonEvidence)
  if (existante)
    refus(
      `cette personne a déjà une fiche solo : ${(existante.groups as unknown as { slug: string }).slug}`,
    )

  const libre = await slugLibre(supabase, artistSlug)
  if (!libre.groupe || !libre.membre)
    refus(
      `slug « ${artistSlug} » déjà pris (${!libre.groupe ? 'groups' : ''}${!libre.groupe && !libre.membre ? ' + ' : ''}${!libre.membre ? 'members' : ''}) — passer --artist-slug=<autre>`,
    )

  if (artistSlug.replace(/-/g, '').length < NOM_TROP_COURT)
    console.log(
      `  ! nom court (« ${artistSlug} ») — aucune chaîne YouTube ne sera seedée automatiquement`,
    )

  const events = await eventsARecuperer(supabase, source.group_id, source.stage_name)
  console.log(
    `\n${events.length} event(s) du groupe nomment ${source.stage_name} en mot entier :${events.length ? '' : ' aucun'}`,
  )
  for (const e of events) console.log(`  ${e.start_at.slice(0, 10)}  [${e.type}]  ${e.title}`)

  if (!APPLY) {
    console.log('\n(dry-run — relancer avec --apply pour écrire)')
    return
  }

  // 1. Le groupe porteur de la fiche solo. Les liens streaming viennent de
  //    MusicBrainz, qui ne rend un résultat que sur match confiant (score ≥ 90
  //    + nom normalisé égal) — sinon `links` reste vide, ce qui vaut mieux que
  //    la discographie d'un homonyme. `mb.members` est IGNORÉ : un soliste n'a
  //    pas de roster à peupler (garde du cas Dayoung, ingest.ts:354).
  const mb = await fetchMbEnrichment(source.stage_name).catch(() => null)
  if (mb) console.log(`\nMusicBrainz : ${Object.keys(mb.links).length} lien(s)`)
  else console.log('\nMusicBrainz : aucun match confiant — fiche sans liens')

  const { data: groupe, error: eG } = await supabase
    .from('groups')
    .insert({
      slug: artistSlug,
      name: source.stage_name,
      is_solo: true,
      agency: source.groupe.agency,
      image_url: source.photo_url,
      links: mb?.links ?? {},
      confidence: 'candidate',
    })
    .select('id')
    .single()
  if (eG) throw new Error(`groups: ${eG.message}`)

  // 2. La row Soloist — real_name et birthday RECOPIÉS, jamais redevinés.
  const { data: soloist, error: eM } = await supabase
    .from('members')
    .insert({
      group_id: groupe.id,
      slug: artistSlug,
      stage_name: source.stage_name,
      position: 'Soloist',
      status: 'active',
      real_name: source.real_name,
      birthday: source.birthday,
      photo_url: source.photo_url,
    })
    .select('id')
    .single()
  if (eM) throw new Error(`members: ${eM.message}`)

  // 3. La row de groupe pointe vers la fiche solo — jamais l'inverse :
  //    `getSoloArtists` et le trigger `compute_group_artist_slug` filtrent tous
  //    deux sur `canonical_id IS NULL`.
  const { error: eLien } = await supabase
    .from('members')
    .update({ canonical_id: soloist.id })
    .eq('id', source.id)
  if (eLien) throw new Error(`canonical_id: ${eLien.message}`)

  // 4. Les sorties solo rejoignent la fiche solo.
  let deplaces = 0
  for (const e of events) {
    const { error } = await supabase
      .from('events')
      .update({ group_id: groupe.id, member_id: null })
      .eq('id', e.id)
    if (error) console.error(`  ✗ ${e.title}: ${error.message}`)
    else deplaces++
  }

  // 5. Relire en base : le trigger a-t-il posé artist_slug ?
  const { data: apres } = await supabase
    .from('groups')
    .select('artist_slug, is_solo')
    .eq('id', groupe.id)
    .single()
  console.log(
    `\nCréé : /artists/${artistSlug} · ${deplaces}/${events.length} event(s) déplacé(s) · artist_slug = ${apres?.artist_slug ?? 'NON POSÉ (trigger muet)'}`,
  )
  if (apres?.artist_slug !== artistSlug)
    console.error('  ! artist_slug absent — la page /artists ne résoudra pas')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
