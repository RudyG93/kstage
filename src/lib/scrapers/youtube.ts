import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

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
  if (/comeback|mini album|full album|single|ep release/.test(text)) return 'comeback'
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

    const { error } = await supabase.from('events').insert({
      group_id: source.group_id,
      source_id: source.id,
      source_url: sourceUrl,
      type: detectEventType(item.snippet.title, item.snippet.description),
      title: item.snippet.title,
      description: item.snippet.description.slice(0, 500) || null,
      start_at: item.snippet.publishedAt,
      status: 'confirmed',
      image_url: item.snippet.thumbnails.default.url,
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
