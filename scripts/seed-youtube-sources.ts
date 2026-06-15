// Seed des sources YouTube (officielle + umbrella label) pour l'élargissement
// de couverture P0.5. Lit le mapping vérifié `scripts/youtube-channels.json`
// (produit par la discovery oembed) et insère les lignes `sources` manquantes.
//
// Idempotent : skip toute (group_id, url) déjà présente. Une même chaîne
// umbrella peut être seedée pour plusieurs groupes (cf. migration 0033,
// UNIQUE(url, group_id)). N'INSÈRE PAS de MV — c'est le rôle du backfill
// (scripts/backfill-youtube.ts), lancé après ce seed.
//
// Usage :
//   npx tsx scripts/seed-youtube-sources.ts            # insère tout le JSON
//   npx tsx scripts/seed-youtube-sources.ts --dry-run  # liste sans écrire
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

function envLocal(key: string): string {
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`))
  if (!line) throw new Error(`${key} absent de .env.local`)
  return line
    .slice(key.length + 1)
    .replace(/^"|"$/g, '')
    .trim()
}

interface ChannelEntry {
  slug: string
  channels: { name: string; url: string }[]
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const supabase = createClient<Database>(
    envLocal('NEXT_PUBLIC_SUPABASE_URL'),
    envLocal('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const entries: ChannelEntry[] = JSON.parse(readFileSync('scripts/youtube-channels.json', 'utf8'))

  // slug -> group_id
  const { data: groups, error: gErr } = await supabase.from('groups').select('id, slug')
  if (gErr) throw gErr
  const groupId = new Map((groups ?? []).map((g) => [g.slug, g.id]))

  // (group_id|url) déjà en DB → skip (idempotence).
  const { data: existing, error: eErr } = await supabase
    .from('sources')
    .select('group_id, url')
    .eq('type', 'youtube_api')
  if (eErr) throw eErr
  const seen = new Set((existing ?? []).map((s) => `${s.group_id}|${s.url}`))

  let inserted = 0
  let skipped = 0
  const missing: string[] = []

  for (const entry of entries) {
    const gid = groupId.get(entry.slug)
    if (!gid) {
      missing.push(entry.slug)
      continue
    }
    for (const ch of entry.channels) {
      const key = `${gid}|${ch.url}`
      if (seen.has(key)) {
        skipped++
        continue
      }
      if (dryRun) {
        console.log(`+ ${entry.slug.padEnd(14)} ${ch.name} → ${ch.url}`)
        inserted++
        seen.add(key)
        continue
      }
      const { error } = await supabase.from('sources').insert({
        name: ch.name,
        type: 'youtube_api',
        url: ch.url,
        group_id: gid,
      })
      if (error) {
        console.error(`✖ ${entry.slug} ${ch.url} — ${error.message}`)
      } else {
        inserted++
        seen.add(key)
      }
    }
  }

  console.log(
    `\n${dryRun ? '[dry-run] ' : ''}${inserted} source(s) ${dryRun ? 'à insérer' : 'insérée(s)'}, ${skipped} déjà présente(s).`,
  )
  if (missing.length) console.warn(`⚠ slugs introuvables en DB: ${missing.join(', ')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
