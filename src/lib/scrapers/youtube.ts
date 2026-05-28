import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { FILTERABLE_EVENT_TYPES } from '@/lib/events/labels'
import { buildEventSlug, generateUniqueSlug } from '@/lib/events/slug'

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

export function detectEventType(title: string, description: string): EventType {
  const text = `${title} ${description}`.toLowerCase()
  // MV (clip) en premier : un titre de clip peut aussi mentionner l'album.
  if (/\bmv\b|\bm\/v\b|music video|official video/.test(text)) return 'mv'
  if (
    /mini album|full album|single album|\balbum\b|\bsingle\b|\bep\b|album release|comeback/.test(
      text,
    )
  )
    return 'release'
  if (/concert|tour/.test(text)) return 'concert'
  if (/m countdown|music bank|inkigayo|show champion|the show|music core/.test(text))
    return 'music_show'
  if (/anniversary|debut/.test(text)) return 'anniversary'
  if (/live|vlive|weverse live|stream/.test(text)) return 'live'
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
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=10&key=${apiKey}`,
  )
  const data = await res.json()

  if (!data.items) throw new Error(`YouTube API error: ${JSON.stringify(data.error ?? data)}`)

  const items: YouTubeSearchItem[] = data.items
  let inserted = 0
  let skipped = 0

  for (const item of items) {
    const sourceUrl = `https://www.youtube.com/watch?v=${item.id.videoId}`

    // On n'ingère que les types couverts au MVP (cf. labels.ts) : beaucoup
    // d'uploads (vlogs, variety…) tombent en 'other' et polluent le calendrier.
    const eventType = detectEventType(item.snippet.title, item.snippet.description)
    if (!FILTERABLE_EVENT_TYPES.includes(eventType)) {
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
      const base = buildEventSlug(groupSlug, item.snippet.title, groupName)
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
      title: item.snippet.title,
      description: item.snippet.description.slice(0, 500) || null,
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
