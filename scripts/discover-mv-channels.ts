/**
 * Découverte des chaînes hébergeant les MVs d'un groupe (catalogues maigres,
 * R3-B 2026-07-12). Méthode éprouvée « jamais de handle deviné » :
 * search.list `"<nom>" MV` → ne retient que les vidéos dont le TITRE porte le
 * groupe (matchesGroup, titre seul §3.10) ET un marqueur MV → une chaîne est
 * candidate si elle héberge ≥ 2 de ces MVs (ou 1 pour les rosters à 1-2 MVs).
 * Sortie : liste vérifiable à ajouter à scripts/youtube-channels.json.
 *
 *   npx tsx scripts/discover-mv-channels.ts pentagon,ab6ix,…
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { matchesGroup } from '../src/lib/scrapers/group-match'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())
const KEY = process.env.YOUTUBE_API_KEY!
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function yt(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, key: KEY })
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${qs}`)
  if (!r.ok) throw new Error(`${path} HTTP ${r.status}`)
  return r.json()
}

async function main() {
  const slugs = (process.argv[2] ?? '').split(',').filter(Boolean)
  if (slugs.length === 0) throw new Error('usage: discover-mv-channels.ts slug1,slug2')
  const { data: groups } = await supabase.from('groups').select('slug, name').in('slug', slugs)

  for (const g of groups ?? []) {
    const byChannel = new Map<string, { title: string; hits: string[] }>()
    for (const q of [`"${g.name}" MV`, `"${g.name}" official music video`]) {
      const d = await yt('search', { part: 'snippet', type: 'video', maxResults: '10', q })
      for (const it of d.items ?? []) {
        const t: string = it.snippet.title
        if (!matchesGroup(t, g.name)) continue
        if (!/\bmv\b|\bm\/v\b|music video/i.test(t)) continue
        if (/teaser|behind|reaction|cover|dance practice|live|fancam|직캠|리액션/i.test(t)) continue
        const c = byChannel.get(it.snippet.channelId) ?? {
          title: it.snippet.channelTitle,
          hits: [],
        }
        if (!c.hits.includes(t)) c.hits.push(t)
        byChannel.set(it.snippet.channelId, c)
      }
    }
    console.log(`\n=== ${g.slug} (${g.name}) ===`)
    for (const [cid, c] of [...byChannel.entries()].sort(
      (a, b) => b[1].hits.length - a[1].hits.length,
    )) {
      const ch = await yt('channels', { part: 'snippet,statistics', id: cid })
      const item = ch.items?.[0]
      const custom = item?.snippet?.customUrl ?? `channel/${cid}`
      const subs = item?.statistics?.subscriberCount ?? '?'
      console.log(
        `  ${c.hits.length} MV(s) | ${c.title} | https://www.youtube.com/${custom} | subs=${subs}` +
          `\n      ex: ${c.hits.slice(0, 2).join(' | ').slice(0, 110)}`,
      )
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
