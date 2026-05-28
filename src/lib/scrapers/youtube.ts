import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { FILTERABLE_EVENT_TYPES } from '@/lib/events/labels'
import { buildEventSlug, generateUniqueSlug } from '@/lib/events/slug'
import { matchesGroup } from './group-match'
import { decodeHtmlEntities } from './html-entities'

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

// Contenu dérivé d'un MV (teasers, behinds, makings…) qu'on ne veut PAS classer
// comme 'mv' : sinon la page /mv/[slug] et la section "MV of the month" se
// remplissent de teasers et behind-the-scenes au lieu des vrais clips.
// `\b` autour des mots ambigus pour éviter les faux négatifs (ex. "preview"
// dans "Recipe Preview" doit matcher mais pas "approval").
const DERIVATIVE_RE =
  /\bbehind\b|\bteaser\b|\btrailer\b|\bmaking[- ]of\b|\brecording\b|\brehearsal\b|\bpractice\b|\bpreview\b|highlight medley|schedule poster|\brecipe\b|cheering guide|performance video|dance practice|documentary|r\(ae\)cord|\breplay\b|compilation|\bepisode\b|\bep\.\s*\d+|\bvlog\b/i

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
  if (/anniversary|debut/.test(lower)) return 'anniversary'
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

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=50&key=${apiKey}`,
  )
  if (!res.ok) throw new Error(`YouTube search API ${res.status} for channel ${channelId}`)
  const data = await res.json()

  if (!data.items) throw new Error(`YouTube API error: ${JSON.stringify(data.error ?? data)}`)

  const items: YouTubeSearchItem[] = data.items
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
