// Remplacer les images de groupe servies par Spotify par l'avatar de leur
// chaîne YouTube officielle.
//
// POURQUOI. Afficher une image Spotify oblige à l'accompagner de leur marque —
// Design Guidelines, verbatim : « If you use any Spotify metadata (including
// artist, album and track names, album artwork and audio playback) it must
// always be accompanied by the Spotify brand ». Coller un logo Spotify sur
// chaque avatar de groupe, dans chaque liste, serait un coût produit lourd pour
// une dépendance qui ne nous rapporte plus rien : `spotify_followers` est NULL
// sur 268/268 depuis que l'API ne l'expose plus en dev-mode, et Spotify est le
// plafond le plus bas de toute la chaîne (coupure de 12 h 40 le 2026-08-21).
//
// L'avatar de la chaîne YouTube officielle est déjà à notre disposition :
// `sources.channel_id` est renseigné sur 178 des 185 groupes concernés, et
// `channels.list` coûte 1 unit par LOT DE 50 — soit 4 units pour tout le
// roster. On garde le HOTLINK (pas de copie) : les YouTube API Services Terms
// bornent le stockage des données d'API, pas leur affichage.
//
//   npx tsx scripts/roster/adopt-youtube-avatars.ts            (revue)
//   npx tsx scripts/roster/adopt-youtube-avatars.ts --apply
//   npx tsx scripts/roster/adopt-youtube-avatars.ts --apply --limit=10
//
// Idempotent : ne touche QUE les groupes dont l'`image_url` vient de Spotify.
// Réversible : le lien Spotify reste en base, `refresh-images` saurait rétablir.
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { isSpotifyImage } from '../../src/lib/images/cloudinary'
import { mentionsArtist } from '../../src/lib/scrapers/group-match'
import type { Database } from '../../src/types/database'

loadEnvConfig(process.cwd())

const APPLY = process.argv.includes('--apply')
const LIMITE = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0)
/** `channels.list` accepte 50 ids pour 1 unit — la facturation est par APPEL. */
const IDS_PAR_LOT = 50

interface Vignettes {
  default?: { url: string }
  medium?: { url: string }
  high?: { url: string }
}

async function avatarsDeChaines(ids: string[], apiKey: string) {
  const out = new Map<string, { url: string; titre: string }>()
  let units = 0
  for (let i = 0; i < ids.length; i += IDS_PAR_LOT) {
    const lot = ids.slice(i, i + IDS_PAR_LOT)
    units++
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${lot.join(',')}&maxResults=50&key=${apiKey}`,
    )
    if (!res.ok) throw new Error(`youtube channels.list ${res.status}`)
    const data = (await res.json()) as {
      items?: { id: string; snippet?: { title?: string; thumbnails?: Vignettes } }[]
    }
    for (const it of data.items ?? []) {
      // `high` = 800×800 chez YouTube, largement au-dessus de nos boîtes.
      const url = it.snippet?.thumbnails?.high?.url ?? it.snippet?.thumbnails?.medium?.url
      if (url) out.set(it.id, { url, titre: it.snippet?.title ?? '' })
    }
  }
  return { avatars: out, units }
}

/** Réduit à ses lettres et chiffres : « Official A.C.E » → « officialace ». */
const compacte = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '')

/**
 * La chaîne appartient-elle à L'ARTISTE, et non à son label ?
 *
 * Deux voies, la seconde parce que la première seule était trop stricte :
 * 1. le titre NOMME l'artiste en mot entier — « Apink (에이핑크) », « VICTON 빅톤 » ;
 * 2. le titre COMPACTÉ contient le nom compacté, à partir de 4 caractères —
 *    rattrape « AILEEOFFICIAL » et « OfficialGDRAGON », que la tokenisation
 *    coupait. Le seuil de 4 évite qu'un nom court se retrouve par hasard dans
 *    un nom de label ; il écarte aussi, volontairement, « A.C.E » et « B.D.U »
 *    (3 lettres compactées) — mieux vaut les laisser sur Spotify que risquer
 *    un logo de label. Aucun label ne contient le nom d'un de ses groupes,
 *    vérifié sur les 49 rejets : SMTOWN, HYBE LABELS, JYP Entertainment,
 *    STARSHIP, FNCEnt, YG ENTERTAINMENT…
 */
function chaineDeLArtiste(titre: string, nom: string, aliases: string[]): boolean {
  if (mentionsArtist(titre, nom, aliases)) return true
  const t = compacte(titre)
  return [nom, ...aliases].some((n) => {
    const c = compacte(n)
    return c.length >= 4 && t.includes(c)
  })
}

async function main() {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    console.error('REFUS — YOUTUBE_API_KEY absent')
    process.exit(1)
  }
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: groupes, error } = await supabase
    .from('groups')
    .select('id, slug, name, name_aliases, image_url, sources(channel_id, type)')
    .order('slug')
  if (error) throw new Error(error.message)

  const cibles: {
    id: string
    slug: string
    nom: string
    aliases: string[]
    channelId: string
  }[] = []
  const sansChaine: string[] = []
  for (const g of groupes ?? []) {
    if (!g.image_url || !isSpotifyImage(g.image_url)) continue
    const srcs = (g.sources ?? []) as unknown as { channel_id: string | null; type: string }[]
    const channelId = srcs.find((s) => s.type === 'youtube_api' && s.channel_id)?.channel_id
    if (!channelId) {
      sansChaine.push(g.slug)
      continue
    }
    cibles.push({
      id: g.id,
      slug: g.slug,
      nom: g.name,
      aliases: (g.name_aliases ?? []) as string[],
      channelId,
    })
  }

  const lot = LIMITE > 0 ? cibles.slice(0, LIMITE) : cibles
  console.log(
    `${cibles.length} groupes servis par Spotify avec une chaîne YouTube connue${LIMITE ? ` — on en traite ${lot.length}` : ''}`,
  )
  if (sansChaine.length)
    console.log(
      `${sansChaine.length} sans chaîne, laissés tels quels : ${sansChaine.slice(0, 12).join(', ')}${sansChaine.length > 12 ? '…' : ''}`,
    )

  const { avatars, units } = await avatarsDeChaines(
    [...new Set(lot.map((c) => c.channelId))],
    apiKey,
  )
  console.log(`\n${avatars.size} avatars récupérés en ${units} unit(s) YouTube\n`)

  let ecrits = 0
  const introuvables: string[] = []
  const chainesDeLabel: string[] = []
  for (const c of lot) {
    const a = avatars.get(c.channelId)
    if (!a) {
      introuvables.push(c.slug)
      continue
    }
    // GARDE DÉCISIVE : beaucoup de groupes sont scrapés depuis la chaîne de
    // leur LABEL, pas la leur — AKMU depuis YG ENTERTAINMENT, AB6IX depuis
    // BRANDNEW MUSIC, ALLDAY PROJECT depuis THEBLACKLABEL. Adopter cet avatar
    // mettrait le logo du label en photo du groupe. On n'accepte donc que si
    // le titre de la chaîne NOMME l'artiste (« Apink (에이핑크) », « VICTON 빅톤 »,
    // « AILEEOFFICIAL » passent ; « Warner Music Korea », « SMTOWN » non).
    if (!chaineDeLArtiste(a.titre, c.nom, c.aliases)) {
      chainesDeLabel.push(`${c.slug} → ${a.titre}`)
      continue
    }
    console.log(`  ${c.slug.padEnd(24)} ← ${a.titre}`)
    if (!APPLY) continue
    const { error: e } = await supabase
      .from('groups')
      .update({ image_url: a.url })
      .eq('id', c.id)
      // Garde de course : on n'écrase que ce qu'on a lu. Si `refresh-images` a
      // écrit entre-temps, on ne remplace pas une valeur qu'on n'a pas vue.
      .like('image_url', '%scdn.co%')
    if (e) console.error(`    ! ${c.slug}: ${e.message}`)
    else ecrits++
  }

  if (chainesDeLabel.length) {
    console.log(
      `\n${chainesDeLabel.length} écarté(s) — la chaîne est celle du label, pas de l'artiste :`,
    )
    for (const l of chainesDeLabel.slice(0, 20)) console.log(`  ${l}`)
    if (chainesDeLabel.length > 20) console.log(`  … et ${chainesDeLabel.length - 20} autres`)
  }
  if (introuvables.length)
    console.log(`\n${introuvables.length} chaîne(s) sans avatar rendu : ${introuvables.join(', ')}`)
  console.log(
    `\n${APPLY ? `${ecrits} image(s) remplacée(s)` : '(revue seule — --apply pour écrire)'}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
