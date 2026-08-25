/**
 * Promotion d'un membre de groupe en SOLISTE — la logique, ses gardes, et rien
 * d'autre. Deux appelants : `scripts/roster/promote-member-to-soloist.ts` (un
 * membre, à la main) et `scripts/roster/promote-soloists-batch.ts` (le lot issu
 * du détecteur). Un seul endroit où les gardes vivent : les dupliquer serait
 * la garantie qu'elles divergent.
 *
 * Un soliste n'est PAS « un groupe à un membre » : c'est une PERSONNE déjà en
 * base. On part donc de sa row `members`, jamais d'un nom — c'est ce qui ferme
 * l'homonymie à la source (« Soyeon » existe chez i-dle ET LABOUM, « Jaehyun »
 * sur 4 rows).
 *
 * `real_name` et `birthday` sont RECOPIÉS de la row source, jamais redevinés :
 * `createFromPayload` appelle `fetchMemberBirthday(stage_name, payload.name)`
 * avec les deux arguments égaux pour un soliste, si bien que le garde
 * anti-homonyme rejette la page correctement désambiguïsée et retient celle de
 * l'homonyme le plus célèbre. C'est ainsi que la fiche `jisoo` a porté
 * `1994-02-11` pendant trois mois.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { isSamePerson, type PersonEvidence } from '@/lib/members/matching'
import { mentionsArtist } from '@/lib/scrapers/group-match'
import { fetchMbEnrichment } from '@/lib/scrapers/musicbrainz'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

/** Un nom trop court matche tout : `ten` vit dans « listen », `roa` dans « broad ». */
export const NOM_TROP_COURT = 4

export function slugifyNom(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export interface SourceMembre {
  id: string
  slug: string | null
  stage_name: string
  real_name: string | null
  birthday: string | null
  photo_url: string | null
  canonical_id: string | null
  group_id: string
  groupe: { slug: string; name: string; agency: string | null; is_solo: boolean | null }
}

export interface EventRepris {
  id: string
  title: string
  type: string
  start_at: string
}

export type Verdict =
  | { ok: false; raison: string }
  | {
      ok: true
      source: SourceMembre
      artistSlug: string
      events: EventRepris[]
      nomCourt: boolean
    }

/** La personne à promouvoir, lue en base et jamais devinée. */
export async function chargerMembre(
  supabase: Client,
  slug: string,
): Promise<SourceMembre | { erreur: string }> {
  const { data, error } = await supabase
    .from('members')
    .select(
      'id, slug, stage_name, real_name, birthday, photo_url, canonical_id, group_id, groups!inner(slug, name, agency, is_solo)',
    )
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return { erreur: `aucun membre de slug « ${slug} »` }
  const groupe = data.groups as unknown as SourceMembre['groupe']
  if (groupe.is_solo) return { erreur: `déjà une fiche solo (${groupe.name})` }
  if (data.canonical_id)
    return { erreur: `n'est pas la row canonique de cette personne — promouvoir la canonique` }
  return { ...data, groupe }
}

/**
 * Toutes les fiches solo existantes, chargées UNE fois. En lot, refaire cette
 * lecture par candidat coûterait 103 requêtes pour une donnée qui ne bouge
 * qu'entre deux promotions — la liste est donc rafraîchie par l'appelant après
 * chaque création.
 */
export async function chargerFichesSolo(supabase: Client): Promise<PersonEvidence[]> {
  const { data, error } = await supabase
    .from('members')
    .select('id, stage_name, real_name, birthday, canonical_id, group_id, groups!inner(slug)')
    .eq('position', 'Soloist')
    .is('canonical_id', null)
    .eq('groups.is_solo', true)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PersonEvidence[]
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
 * Events du groupe d'origine dont le TITRE nomme le membre en MOT ENTIER.
 * Jamais une sous-chaîne : une sortie attribuée à la mauvaise personne coûte
 * bien plus cher qu'une sortie manquante (cf. les 3 MV de SISTAR attribués à
 * IVE, audit 2026-08-21).
 */
export async function eventsANommer(
  supabase: Client,
  groupId: string,
  nom: string,
): Promise<EventRepris[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, type, start_at')
    .eq('group_id', groupId)
    // Un event masqué reste où il est : le déplacer le ferait changer de fiche
    // sans que personne ne puisse le voir ni le vérifier.
    .eq('hidden', false)
    .order('start_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).filter((e) => mentionsArtist(e.title, nom))
}

/** Toutes les gardes, sans rien écrire. Le lot s'en sert pour trier à blanc. */
export async function evaluer(
  supabase: Client,
  memberSlug: string,
  fichesSolo: PersonEvidence[],
  artistSlugDemande?: string | null,
): Promise<Verdict> {
  const chargee = await chargerMembre(supabase, memberSlug)
  if ('erreur' in chargee) return { ok: false, raison: chargee.erreur }
  const source = chargee

  const dejaSoliste = fichesSolo.find((m) => isSamePerson(source as PersonEvidence, m))
  if (dejaSoliste) return { ok: false, raison: `cette personne a déjà une fiche solo` }

  const artistSlug = artistSlugDemande ?? slugifyNom(source.stage_name)
  const libre = await slugLibre(supabase, artistSlug)
  if (!libre.groupe || !libre.membre)
    return { ok: false, raison: `slug « ${artistSlug} » déjà pris — passer --artist-slug=<autre>` }

  return {
    ok: true,
    source,
    artistSlug,
    events: await eventsANommer(supabase, source.group_id, source.stage_name),
    nomCourt: artistSlug.replace(/-/g, '').length < NOM_TROP_COURT,
  }
}

export interface Resultat {
  artistSlug: string
  liens: number
  eventsDeplaces: number
  artistSlugPose: string | null
}

/**
 * Écrit la fiche. À n'appeler QUE sur un verdict `ok` — les gardes ne sont pas
 * rejouées ici.
 *
 * L'ordre compte : le groupe, puis la row Soloist, puis le lien canonical DANS
 * CE SENS (la row de groupe pointe vers la fiche solo, jamais l'inverse —
 * `getSoloArtists` et le trigger `compute_group_artist_slug` filtrent tous deux
 * sur `canonical_id IS NULL`, donc l'inverse effacerait `artist_slug` et
 * rendrait la page inatteignable).
 */
export async function promouvoir(
  supabase: Client,
  v: Extract<Verdict, { ok: true }>,
): Promise<Resultat> {
  const { source, artistSlug, events } = v

  // MusicBrainz ne rend un résultat que sur match confiant (score ≥ 90 + nom
  // normalisé égal) ; sinon `links` reste vide, ce qui vaut mieux que la
  // discographie d'un homonyme. `mb.members` est IGNORÉ : un soliste n'a pas de
  // roster à peupler (garde du cas Dayoung).
  const mb = await fetchMbEnrichment(source.stage_name).catch(() => null)

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

  const { error: eLien } = await supabase
    .from('members')
    .update({ canonical_id: soloist.id })
    .eq('id', source.id)
  if (eLien) throw new Error(`canonical_id: ${eLien.message}`)

  let eventsDeplaces = 0
  if (events.length > 0) {
    const { error } = await supabase
      .from('events')
      .update({ group_id: groupe.id, member_id: null })
      .in(
        'id',
        events.map((e) => e.id),
      )
    if (error) console.error(`  ✗ events ${artistSlug}: ${error.message}`)
    else eventsDeplaces = events.length
  }

  // Relire en base : le trigger a-t-il posé artist_slug ? Sans lui la page
  // /artists ne résout pas, et l'échec serait silencieux.
  const { data: apres } = await supabase
    .from('groups')
    .select('artist_slug')
    .eq('id', groupe.id)
    .single()

  return {
    artistSlug,
    liens: Object.keys(mb?.links ?? {}).length,
    eventsDeplaces,
    artistSlugPose: apres?.artist_slug ?? null,
  }
}
