import type { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { scanFandomDiscography } from './fandom-discography'
import { searchPageIds, fetchInfobox } from './debuts/fandom'
import { normalizeDebutName } from './debuts/wikipedia-debuts'
import { fetchVideosAsUploads, scrapeGroup } from './youtube'

type SupabaseClient = ReturnType<typeof createClient<Database>>

/**
 * Récupération des MV manquants d'un groupe par sa DISCOGRAPHIE fandom
 * (nuit 2026-08-21) — le remède qui marche là où « relancer le scraper »
 * ne pouvait rien.
 *
 * Pourquoi : le scraper quotidien ne lit que les chaînes déclarées en
 * `sources`. Quand les MV d'un groupe vivent ailleurs (chaîne du label :
 * OURBIRTHDAY « SQUEEZY » sur JYP Entertainment), aucun nombre de relances ne
 * les fera apparaître. La discographie fandom, elle, cite les liens YouTube
 * quelle que soit la chaîne — et ne coûte rien.
 *
 * Coût par groupe : ~2-19 requêtes fandom (gratuites) + 1 unit YouTube par lot
 * de 50 vidéos. À comparer aux 200 units de la découverte par `search.list`,
 * dont le quota quotidien est étroit (429 constaté le 21/08).
 *
 * Les gates ne changent pas : `scrapeGroup` reçoit les vidéos en `uploads`
 * injectés et applique titre officiel, appartenance au groupe, durée ≥ 75 s,
 * dédup ±14 j, slug, mv_kind.
 */
export interface MvRecoveryResult {
  groupSlug: string
  /** Titre de page fandom résolu (null = groupe introuvable côté fandom). */
  page: string | null
  scanned: number
  inserted: number
  skipped: number
  units: number
  reason: string | null
}

/** Titre de page fandom d'un groupe : son nom d'abord, sinon recherche. */
async function resolveFandomPage(name: string): Promise<string | null> {
  const direct = await scanFandomDiscography(name)
  if (direct.reason !== 'page fandom introuvable') return name
  for (const pageid of await searchPageIds(name, 5)) {
    const { infobox } = await fetchInfobox(pageid)
    if (infobox?.name && normalizeDebutName(infobox.name) === normalizeDebutName(name))
      return infobox.name
  }
  return null
}

/**
 * Complète `groups.name_aliases` avec les graphies officielles de l'infobox
 * (hangul, hanja, romanisation). SANS ça, un MV titré « 미완소년(未完少年)
 * 'PLUMA' MV » ne s'attribue jamais à MiiWAN : le gate `matchesGroup` ne
 * connaît que le nom latin. Fusion additive — les alias déjà saisis restent.
 */
async function syncGroupAliases(
  supabase: SupabaseClient,
  groupId: string,
  pageTitle: string,
  current: readonly string[],
): Promise<string[]> {
  for (const pageid of await searchPageIds(pageTitle, 3)) {
    const { infobox } = await fetchInfobox(pageid)
    if (!infobox?.name || normalizeDebutName(infobox.name) !== normalizeDebutName(pageTitle))
      continue
    const merged = [...current]
    for (const alias of infobox.aliases) {
      if (!merged.some((a) => a.toLowerCase() === alias.toLowerCase())) merged.push(alias)
    }
    if (merged.length > current.length) {
      await supabase.from('groups').update({ name_aliases: merged }).eq('id', groupId)
    }
    return merged
  }
  return [...current]
}

export async function recoverMvsFromFandom(
  supabase: SupabaseClient,
  groupId: string,
  apiKey: string,
): Promise<MvRecoveryResult> {
  const { data: group } = await supabase
    .from('groups')
    .select('id, slug, name, name_aliases')
    .eq('id', groupId)
    .single()
  if (!group)
    return {
      groupSlug: '?',
      page: null,
      scanned: 0,
      inserted: 0,
      skipped: 0,
      units: 0,
      reason: 'groupe introuvable',
    }

  const base = {
    groupSlug: group.slug,
    scanned: 0,
    inserted: 0,
    skipped: 0,
    units: 0,
  }

  const page = await resolveFandomPage(group.name)
  if (!page) return { ...base, page: null, reason: 'page fandom introuvable' }

  // Alias AVANT le scrape : c'est le gate `matchesGroup` qui décide, et il lit
  // `name_aliases` fraîchement enrichis (hangul/hanja/roman).
  await syncGroupAliases(supabase, groupId, page, group.name_aliases ?? [])

  const scan = await scanFandomDiscography(page)
  if (scan.videoIds.length === 0)
    return { ...base, page, reason: scan.reason ?? 'aucun lien MV dans la discographie' }

  const { items, units } = await fetchVideosAsUploads(scan.videoIds, apiKey)
  if (items.length === 0)
    return { ...base, page, units, scanned: scan.videoIds.length, reason: 'vidéos indisponibles' }

  // Source EXISTANTE si le groupe en a une (l'event garde alors son source_id),
  // sinon source synthétique : id vide = pas de row `sources` à stamper.
  const { data: src } = await supabase
    .from('sources')
    .select('id, url')
    .eq('group_id', groupId)
    .eq('type', 'youtube_api')
    .limit(1)
    .maybeSingle()

  const res = await scrapeGroup(
    { id: src?.id ?? '', url: src?.url ?? '', group_id: groupId },
    apiKey,
    supabase,
    { uploads: items },
  )

  return {
    groupSlug: group.slug,
    page,
    scanned: scan.videoIds.length,
    inserted: res.inserted,
    skipped: res.skipped,
    units: units + res.units,
    reason: res.inserted === 0 ? 'aucun MV nouveau retenu par les gates' : null,
  }
}
