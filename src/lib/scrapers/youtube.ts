import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { FILTERABLE_EVENT_TYPES } from '@/lib/events/labels'
import { buildEventSlug, generateUniqueSlug } from '@/lib/events/slug'
import { matchesGroup } from './group-match'
import { decodeHtmlEntities } from './html-entities'
import { isOfficialMvTitle } from './is-official-mv'
import { detectMvVersion, type MemberRef } from './mv-version'

type EventType = Database['public']['Enums']['event_type']
type SupabaseClient = ReturnType<typeof createClient<Database>>

interface YouTubeSearchItem {
  id: { videoId: string }
  snippet: {
    title: string
    description: string
    publishedAt: string
    thumbnails: { default: { url: string } }
  }
}

interface ScrapeResult {
  inserted: number
  skipped: number
}

// Contenu dérivé d'un MV (teasers, behinds, makings, reactions…) qu'on ne veut
// PAS classer comme 'mv' : sinon la page /mv/[slug] et la section "MV of the
// month" se remplissent de teasers, behind-the-scenes et reactions au lieu des
// vrais clips. `\b` autour des mots ambigus EN pour éviter les faux négatifs
// (ex. "preview" dans "Recipe Preview" doit matcher mais pas "approval").
//
// Markers hangul ajoutés après audit MCP (cf. SCRAPING.md §3.6) : les chaînes
// officielles K-pop postent massivement du contenu en coréen. Sans ces markers,
// les séries "I-TALK #X : 'XXX' M/V 촬영 비하인드" passaient en 'mv'.
//   비하인드 = "behind"   메이킹 = "making"   티저 = "teaser"
//   리액션 = "reaction"   현장 = "on-site/scene"   예고 = "preview"
const DERIVATIVE_RE =
  /\bbehind\b|\bteaser\b|\btrailer\b|\bmaking[- ]of\b|\brecording\b|\brehearsal\b|\bpractice\b|\bpreview\b|\breaction\b|highlight medley|highlight clip|schedule poster|\brecipe\b|cheering guide|performance video|dance practice|documentary|r\(ae\)cord|\breplay\b|compilation|\bepisode\b|\bep\.\s*\d+|\bvlog\b|비하인드|메이킹|티저|리액션|현장|예고/i

export function detectEventType(title: string, description: string): EventType {
  const text = `${title} ${description}`
  // Early-reject derivatives : ils peuvent contenir "MV", "Album", etc. sans
  // pour autant représenter l'event réel — on les renvoie tous en 'other'.
  if (DERIVATIVE_RE.test(text)) return 'other'

  const lower = text.toLowerCase()
  // MV (clip) en premier : un titre de clip peut aussi mentionner l'album.
  if (/\bmv\b|\bm\/v\b|music video|official video/.test(lower)) return 'mv'
  if (
    /mini album|full album|single album|\balbum\b|\bsingle\b|\bep\b|album release|comeback/.test(
      lower,
    )
  )
    return 'release'
  if (/concert|tour/.test(lower)) return 'concert'
  if (/m countdown|music bank|inkigayo|show champion|the show|music core/.test(lower))
    return 'music_show'
  // 'anniversary' n'est jamais scrapé : les anniversaires sont auto-générés à
  // la volée depuis members.birthday + groups.debut_date (cf. anniversaries.ts).
  // Le scraper YT classait en faux positif tout titre contenant "Debut"
  // (BABYMONSTER "DEBUT SPECIAL"/"PRE-DEBUT SONG"…).
  if (/live|vlive|weverse live|stream/.test(lower)) return 'live'
  return 'other'
}

async function resolveChannelId(channelUrl: string, apiKey: string): Promise<string> {
  // Handle /channel/UC... format
  const direct = channelUrl.match(/\/channel\/(UC[\w-]+)/)?.[1]
  if (direct) return direct

  // Handle @handle format
  const handle = channelUrl.match(/@[\w.-]+/)?.[0]
  if (!handle) throw new Error(`Cannot parse channel URL: ${channelUrl}`)

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`,
  )
  if (!res.ok) throw new Error(`YouTube channels API ${res.status} for handle ${handle}`)
  const data = await res.json()
  const id: string | undefined = data.items?.[0]?.id
  if (!id) throw new Error(`Channel not found for handle: ${handle}`)
  return id
}

/**
 * Une passe de `search.list` sur une chaîne. Encapsule l'URL, le check `res.ok`
 * et la vérification `data.items` pour pouvoir appeler le scrape plusieurs fois
 * avec des paramètres différents (order=date vs q-filtered).
 */
async function fetchSearch(args: {
  channelId: string
  apiKey: string
  params: string
}): Promise<YouTubeSearchItem[]> {
  const { channelId, apiKey, params } = args
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}` +
      `&type=video&${params}&key=${apiKey}`,
  )
  if (!res.ok) throw new Error(`YouTube search API ${res.status} for channel ${channelId}`)
  const data = await res.json()
  if (!data.items) throw new Error(`YouTube API error: ${JSON.stringify(data.error ?? data)}`)
  return data.items as YouTubeSearchItem[]
}

export async function scrapeGroup(
  source: { id: string; url: string; group_id: string },
  apiKey: string,
  supabase: SupabaseClient,
): Promise<ScrapeResult> {
  const channelId = await resolveChannelId(source.url, apiKey)

  // Charge le slug + name du groupe pour générer les slugs d'events.
  // Le name est nécessaire pour dédupliquer les préfixes quand le titre scrapé
  // commence par le nom du groupe (cf. buildEventSlug).
  const { data: group } = await supabase
    .from('groups')
    .select('slug, name')
    .eq('id', source.group_id)
    .maybeSingle()
  const groupSlug = group?.slug ?? null
  const groupName = group?.name ?? null

  // Membres du groupe (pour detectMvVersion). Charge une seule fois par scrape.
  const { data: membersData } = await supabase
    .from('members')
    .select('id, stage_name')
    .eq('group_id', source.group_id)
  const members: MemberRef[] = membersData ?? []

  // Pass A : 50 derniers uploads (toutes catégories) — capte les nouveaux events
  // au fil de l'eau (music_show, anniversary, concert, vraiment-récent-MV, etc.).
  const itemsA = await fetchSearch({
    channelId,
    apiKey,
    params: 'order=date&maxResults=50',
  })

  // Pass B : MVs sur tout l'historique de la chaîne — résout la fenêtre étroite
  // d'order=date. Sur les chaînes officielles à fort débit (vlogs/i-talk/etc.),
  // les 50 derniers uploads ne remontent que ~1-2 mois et ratent les MVs sortis
  // il y a 6-12 mois (Klaxon, Whiplash, Magnetic…). Sur les chaînes d'agence
  // (SMTOWN, YG, HYBE…), la query filtre directement les MVs du groupe ciblé.
  // Skip si groupName est null (cas dégénéré, on retombe sur Pass A seule).
  const itemsB = groupName
    ? await fetchSearch({
        channelId,
        apiKey,
        params: `q=${encodeURIComponent(`${groupName} Music Video`)}&maxResults=50`,
      })
    : []

  // Dédup par videoId : un MV récemment uploadé peut apparaître dans les 2 passes.
  // On le voit une seule fois pour ne pas faire double idempotence-check.
  const seen = new Set<string>()
  const items: YouTubeSearchItem[] = []
  for (const it of [...itemsA, ...itemsB]) {
    if (seen.has(it.id.videoId)) continue
    seen.add(it.id.videoId)
    items.push(it)
  }

  let inserted = 0
  let skipped = 0

  for (const item of items) {
    const sourceUrl = `https://www.youtube.com/watch?v=${item.id.videoId}`

    // L'API YouTube renvoie les titres/descriptions HTML-encodés (`&#39;` etc.).
    // On décode une fois en entrée pour que tous les usages aval (detectType,
    // slug, insert, affichage) voient du texte propre.
    const title = decodeHtmlEntities(item.snippet.title)
    const description = decodeHtmlEntities(item.snippet.description)

    // On n'ingère que les types couverts au MVP (cf. labels.ts) : beaucoup
    // d'uploads (vlogs, variety…) tombent en 'other' et polluent le calendrier.
    const eventType = detectEventType(title, description)
    if (!FILTERABLE_EVENT_TYPES.includes(eventType)) {
      skipped++
      continue
    }

    // §4.1 — gate strict « MV officiel uniquement ». detectEventType classe
    // largement en 'mv' (tout titre avec un marqueur MV) ; ce filtre exige en
    // plus l'absence de tout terme dérivé (teaser, performance, out now, etc.)
    // pour ne garder que le clip principal. Les rejets sont loggués pour audit.
    if (eventType === 'mv') {
      const check = isOfficialMvTitle(title)
      if (!check.official) {
        console.warn(`[yt] skip non-official MV (${check.reason}): ${title}`)
        skipped++
        continue
      }
    }

    // Filtre nom de groupe : sur une chaîne d'agence (SMTOWN, YG, HYBE…),
    // évite d'ingérer les MVs des autres groupes signés à la même agence.
    // Sur une chaîne officielle, skip aussi les vlogs persos d'un membre dont
    // le titre ne mentionne pas le groupe. Si groupName est null pour une
    // raison quelconque, on garde le comportement non filtré.
    if (groupName && !matchesGroup(`${title} ${description}`, groupName)) {
      skipped++
      continue
    }

    // Idempotence : vérifie si cet event existe déjà
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('source_url', sourceUrl)
      .maybeSingle()

    if (existing) {
      skipped++
      continue
    }

    // Slug pour la route article (`/mv/[slug]`). Skip si on n'a pas pu récupérer
    // le slug du groupe (cas dégénéré ; l'event est inséré sans slug et sera
    // rattrapé par le backfill).
    let slug: string | null = null
    if (groupSlug) {
      const base = buildEventSlug(groupSlug, title, groupName)
      slug = await generateUniqueSlug(base, async (candidate) => {
        const { data } = await supabase
          .from('events')
          .select('id')
          .eq('slug', candidate)
          .maybeSingle()
        return Boolean(data)
      })
    }

    // mv_kind + member_id : seulement pour les MVs. Pour les autres types,
    // valeur null (default DB) — préserve l'invariant CHECK de la migration.
    let mvKind: 'main' | 'performance' | 'member' | 'other_version' | null = null
    let memberId: string | null = null
    if (eventType === 'mv') {
      const v = detectMvVersion(title, members)
      mvKind = v.kind
      memberId = v.memberId
    }

    const { error } = await supabase.from('events').insert({
      group_id: source.group_id,
      source_id: source.id,
      source_url: sourceUrl,
      type: eventType,
      title,
      description: description.slice(0, 500) || null,
      start_at: item.snippet.publishedAt,
      status: 'confirmed',
      image_url: item.snippet.thumbnails.default.url,
      slug,
      mv_kind: mvKind,
      member_id: memberId,
    })

    if (error) {
      console.error(`Insert failed for ${sourceUrl}:`, error.message)
      skipped++
    } else {
      inserted++
    }
  }

  await supabase
    .from('sources')
    .update({ last_scraped_at: new Date().toISOString() })
    .eq('id', source.id)

  return { inserted, skipped }
}
