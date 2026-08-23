// Data-health monitor (round 2026-07-18) — codifie CHAQUE classe d'erreur data
// déjà rencontrée en check automatique, pour que les régressions remontent
// d'elles-mêmes (admin /admin/health + résumé quotidien via le cron monitor)
// au lieu d'être re-découvertes par Rudy surface par surface.
//
// Classes couvertes (origine entre parenthèses) :
//   photos membres manquantes (idntt 2026-07-18), objets Storage surdimensionnés
//   (SuA 17 Mo), catalogues MV maigres (UNIS, 41 groupes), lineup unmatched,
//   épisodes non numérotés + numérotation incohérente (Music Bank #1294/#1295),
//   stages manquants après fenêtre (MB 1295 — MONSTA X/Sunmi/TXT), titres
//   placeholder « X debut » (OURBIRTHDAY), groupes pre-debut incomplets,
//   sources muettes, erreurs scrape_log, personnes dupliquées cross-groupe
//   (SuA Dreamcatcher/UAU).
import type { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { isConsistentRiffSize, isValidWebpHeader } from '@/lib/images/upload'
import { isSamePerson, normalizeName } from '@/lib/members/matching'
import { activityStatus } from '@/lib/groups/activity'
import { SHOW_DESCRIPTORS } from '@/lib/scrapers/music-shows/types'
import { isOfficialMvTitle } from '@/lib/scrapers/is-official-mv'
import { isPlaceholderRelease } from '@/lib/scrapers/comeback-ingest'

type SupabaseClient = ReturnType<typeof createClient<Database>>

export type HealthCheck = {
  id: string
  label: string
  severity: 'info' | 'warn'
  count: number
  // Lignes d'exemple prêtes à afficher (bornées — jamais la liste complète).
  sample: string[]
}

export type DataHealthReport = {
  generatedAt: string
  checks: HealthCheck[]
}

const SAMPLE_MAX = 15
// Seuil « objet Storage surdimensionné » : au-delà, l'avatar pèse plus que la
// page qui l'affiche (et >10 Mo casse Cloudinary fetch).
export const OVERSIZED_BYTES = 400_000
// Catalogue MV « maigre » : sous ce seuil, une page groupe paraît vide.
export const THIN_MV_THRESHOLD = 5
// La fenêtre d'enrichissement stage-links s'arrête à air+4j : au-delà, un stage
// manquant ne se remplira plus tout seul (backfill requis).
const STAGE_WINDOW_DAYS = 4

// ── Helpers purs (testés) ────────────────────────────────────────────────────

export { normalizeName }

/** Titre d'event générique posé par l'ingest debuts (« {groupe} debut »). */
export function isPlaceholderTitle(title: string, groupName: string): boolean {
  return title.trim().toLowerCase() === `${groupName.trim().toLowerCase()} debut`
}

export type EpisodeRow = { show_title: string; kst_day: string; episode_number: number | null }

/**
 * Incohérences de numérotation par show : entre deux épisodes NUMÉROTÉS
 * consécutifs A < B, chaque épisode en base strictement entre eux a dû
 * incrémenter le numéro — delta attendu = (épisodes entre) + 1. Un delta
 * différent = un des numéros parsés est faux OU il nous manque des épisodes ;
 * dans les deux cas c'est à vérifier contre une source autoritaire, jamais à
 * deviner (cas réel : MB #1294 au 2026-06-05 et #1295 au 2026-07-17 avec
 * 5 épisodes entre les deux).
 */
export function findNumberingConflicts(episodes: readonly EpisodeRow[]): string[] {
  const byShow = new Map<string, EpisodeRow[]>()
  for (const e of episodes) {
    const list = byShow.get(e.show_title) ?? []
    list.push(e)
    byShow.set(e.show_title, list)
  }
  const conflicts: string[] = []
  for (const [show, list] of byShow) {
    const sorted = [...list].sort((a, b) => a.kst_day.localeCompare(b.kst_day))
    const numbered = sorted.filter((e) => e.episode_number != null)
    for (let i = 1; i < numbered.length; i++) {
      const a = numbered[i - 1]
      const b = numbered[i]
      const between = sorted.filter((e) => e.kst_day > a.kst_day && e.kst_day < b.kst_day).length
      const expected = between + 1
      const actual = (b.episode_number ?? 0) - (a.episode_number ?? 0)
      // delta SUPÉRIEUR à l'attendu = des épisodes nous manquent entre les deux
      // — c'est le sujet de `findMissingEpisodes`, qui le dit avec les dates
      // précises. Ne restent ici que les vraies CONTRADICTIONS : même numéro
      // deux semaines de suite, régression chronologique, ou saut trop court.
      // Les mélanger rendait le bloc illisible (11 lignes affichées dont 9
      // n'étaient que des trous de collecte, capture Rudy du 2026-08-21).
      if (actual <= 0) {
        conflicts.push(
          `${show}: #${a.episode_number} (${a.kst_day}) → #${b.episode_number} (${b.kst_day}) — numéro identique ou en recul`,
        )
      } else if (actual < expected) {
        conflicts.push(
          `${show}: #${a.episode_number} (${a.kst_day}) → #${b.episode_number} (${b.kst_day}) — delta ${actual} pour ${between} épisodes entre (attendu ${expected})`,
        )
      }
    }
  }
  return conflicts
}

export type SlotSpec = { showTitle: string; weekday: number }

/**
 * Épisodes RÉELLEMENT diffusés qui manquent en base, arbitrés par la
 * NUMÉROTATION et non par le calendrier.
 *
 * Un simple « pas d'épisode ce mardi » ne prouve rien : les chaînes coréennes
 * déprogramment (결방) régulièrement. Mesuré le 2026-08-21, la version
 * calendaire signalait 9 trous dont 8 FAUX — Inkigayo #1317 (28/06) est suivi
 * de #1318 (12/07) : numéros consécutifs à 14 jours d'écart, donc le 05/07
 * n'a jamais existé. Idem Music Bank #1296 → #1297 sur 21 jours (Coupe du
 * monde). Seul M Countdown #936 (09/07) → #938 (23/07) laisse un vrai trou :
 * l'épisode #937 a bien été diffusé et nous manque.
 *
 * On ne signale donc QUE les créneaux situés dans un saut de numérotation. Hors
 * de la plage numérotée on ne conclut rien (l'alerte J-1 du cron couvre le
 * bord droit).
 */
export function findMissingEpisodes(
  episodes: readonly EpisodeRow[],
  preempted: ReadonlySet<string>,
  slots: readonly SlotSpec[],
  sinceDay: string,
  untilDay: string,
): string[] {
  const out: string[] = []
  for (const slot of slots) {
    const rows = episodes
      .filter((e) => e.show_title === slot.showTitle)
      .sort((a, b) => a.kst_day.localeCompare(b.kst_day))
    const numbered = rows.filter((e) => e.episode_number != null)
    for (let i = 1; i < numbered.length; i++) {
      const a = numbered[i - 1]
      const b = numbered[i]
      const between = rows.filter((e) => e.kst_day > a.kst_day && e.kst_day < b.kst_day)
      const holes = (b.episode_number ?? 0) - (a.episode_number ?? 0) - 1 - between.length
      if (holes <= 0) continue
      const known = new Set(rows.map((e) => e.kst_day))
      for (
        let t = Date.parse(`${a.kst_day}T00:00:00Z`) + 86_400_000;
        t < Date.parse(`${b.kst_day}T00:00:00Z`);
        t += 86_400_000
      ) {
        const d = new Date(t)
        if (d.getUTCDay() !== slot.weekday) continue
        const day = d.toISOString().slice(0, 10)
        if (day < sinceDay || day > untilDay) continue
        if (known.has(day) || preempted.has(`${slot.showTitle}|${day}`)) continue
        out.push(`${slot.showTitle} — ${day} (entre #${a.episode_number} et #${b.episode_number})`)
      }
    }
  }
  return out.sort((x, y) => y.localeCompare(x))
}

export type MemberRow = {
  id: string
  slug: string
  stage_name: string
  real_name: string | null
  birthday: string | null
  canonical_id: string | null
  group_id: string
  group_name: string
}

/**
 * Candidats « même personne dans deux groupes » non canonical-liés. La preuve
 * vit dans `isSamePerson` (src/lib/members/matching.ts) — source unique
 * partagée avec l'auto-lien de l'ingest, garde anti-homonymes incluse.
 */
export function findDuplicatePersonCandidates(members: readonly MemberRow[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i]
      const b = members[j]
      if (a.group_id === b.group_id) continue
      if (a.canonical_id != null || b.canonical_id != null) continue
      if (!isSamePerson(a, b)) continue
      const key = [a.id, b.id].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      out.push(
        `${a.stage_name} (${a.group_name}, ${a.slug}) ↔ ${b.stage_name} (${b.group_name}, ${b.slug})`,
      )
    }
  }
  return out
}

// ── Fetch paginé (cap PostgREST 1000 rows) ───────────────────────────────────

// MV **et** releases : le comptage « catalogue maigre » ne regarde que les mv,
// mais la DERNIÈRE SORTIE (qui décide du statut d'activité) compte les deux.
async function fetchAllMvEvents(supabase: SupabaseClient) {
  const rows: { group_id: string | null; start_at: string; type: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('events')
      .select('group_id, start_at, type')
      .in('type', ['mv', 'release'])
      .eq('hidden', false)
      .range(from, from + 999)
    if (error) throw new Error(`events mv: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

// members a franchi le cap PostgREST de 1000 rows (1162 au 2026-08-08) : sans
// pagination, les ~160 derniers étaient absents des checks → le croisement
// oversized comptait leurs photos comme orphelines (8 purgées à tort le 07/08).
async function fetchAllMembers(supabase: SupabaseClient) {
  const rows: {
    id: string
    slug: string | null
    stage_name: string
    real_name: string | null
    birthday: string | null
    canonical_id: string | null
    group_id: string
    photo_url: string | null
    status: string
    groups: { name: string } | null
  }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('members')
      .select(
        'id, slug, stage_name, real_name, birthday, canonical_id, group_id, photo_url, status, groups!inner(name)',
      )
      .range(from, from + 999)
    if (error) throw new Error(`members: ${error.message}`)
    rows.push(...((data ?? []) as unknown as typeof rows))
    if (!data || data.length < 1000) break
  }
  return rows
}

// Échantillon d'URLs d'images par colonne, testées en HEAD (audit 2026-08-20 :
// la seule dérive « image cassée » détectable l'était par l'œil de Rudy — 18/90
// maxres YouTube en 404). ~15 URLs par colonne, timeout court : le monitor
// quotidien absorbe ~75 requêtes sans peser.
const DEAD_URL_SAMPLE = 15
const DEAD_URL_TIMEOUT_MS = 5_000

async function sampleDeadImageUrls(
  urls: readonly { url: string; label: string }[],
): Promise<string[]> {
  const results = await Promise.all(
    urls.map(async ({ url, label }) => {
      try {
        // Webp self-hosté : valider le CONTENU (signature RIFF/WEBP via Range),
        // pas juste le statut — incident 2026-08-20 : 180 objets corrompus par
        // la couche upload du runtime Vercel étaient servis HTTP 200 mais
        // rejetés par les navigateurs et Cloudinary.
        if (url.includes('/storage/v1/object/public/') && url.includes('.webp')) {
          const res = await fetch(url, {
            headers: { Range: 'bytes=0-15' },
            signal: AbortSignal.timeout(DEAD_URL_TIMEOUT_MS),
          })
          if (!res.ok && res.status !== 206) return `${label} — HTTP ${res.status} — ${url}`
          const head = Buffer.from(await res.arrayBuffer())
          if (!isValidWebpHeader(head)) return `${label} — webp corrompu (header) — ${url}`
          // Taille totale via Content-Range (« bytes 0-15/83391 ») : la
          // corruption U+FFFD peut gonfler le CORPS en laissant le header
          // intact (cas 9b31e537, 2026-08-20) — riff_size + 8 doit = total.
          const total = Number(res.headers.get('content-range')?.split('/')[1] ?? 0)
          if (total > 0 && !isConsistentRiffSize(head, total))
            return `${label} — webp corrompu (taille RIFF ${head.readUInt32LE(4) + 8} ≠ ${total}) — ${url}`
          return null
        }
        const res = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(DEAD_URL_TIMEOUT_MS),
        })
        // Certains CDN refusent HEAD (405) : re-tester en GET avant de flagger.
        if (res.status === 405) {
          const get = await fetch(url, { signal: AbortSignal.timeout(DEAD_URL_TIMEOUT_MS) })
          return get.ok ? null : `${label} — HTTP ${get.status} — ${url}`
        }
        return res.ok ? null : `${label} — HTTP ${res.status} — ${url}`
      } catch {
        // Timeout/réseau : ne pas flagger (transitoire ≠ mort) — le check vise
        // les 404 durables, pas la météo réseau du runner.
        return null
      }
    }),
  )
  return results.filter((r): r is string => r !== null)
}

async function listBucketOversized(supabase: SupabaseClient, bucket: string) {
  const hits: { name: string; size: number }[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list('', { limit: 1000, offset })
    if (error) throw new Error(`storage ${bucket}: ${error.message}`)
    for (const o of data ?? []) {
      const size = (o.metadata as { size?: number } | null)?.size ?? 0
      if (size > OVERSIZED_BYTES) hits.push({ name: `${bucket}/${o.name}`, size })
    }
    if (!data || data.length < 1000) break
  }
  return hits
}

// ── Runner ──────────────────────────────────────────────────────────────────

export async function runDataHealthChecks(supabase: SupabaseClient): Promise<DataHealthReport> {
  const now = new Date()
  const nowIso = now.toISOString()
  const today = nowIso.slice(0, 10)
  const checks: HealthCheck[] = []

  // Jeux partagés par plusieurs checks. members est PAGINÉ (cap 1000 franchi).
  const [{ data: groups }, members, mvRows] = await Promise.all([
    supabase
      .from('groups')
      .select(
        'id, name, slug, is_solo, debut_date, disbanded_on, image_url, image_landscape, banner_yt_url',
      ),
    fetchAllMembers(supabase),
    fetchAllMvEvents(supabase),
  ])
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]))

  // 1. Membres actifs sans photo, groupés par groupe (pire d'abord).
  {
    const missing = (members ?? []).filter((m) => m.status === 'active' && !m.photo_url)
    const byGroup = new Map<string, string[]>()
    for (const m of missing) {
      const name = groupById.get(m.group_id)?.name ?? '?'
      byGroup.set(name, [...(byGroup.get(name) ?? []), m.stage_name])
    }
    const sample = [...byGroup.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, SAMPLE_MAX)
      .map(([g, names]) => `${g} — ${names.length} sans photo (${names.slice(0, 5).join(', ')})`)
    checks.push({
      id: 'members_without_photo',
      label: 'Membres actifs sans photo',
      severity: 'warn',
      count: missing.length,
      sample,
    })
  }

  // 1bis. Photos PARTAGÉES entre plusieurs membres : fandom renvoie l'image
  // principale de la page, qui est la photo de GROUPE (ou une pochette, ou un
  // logo d'émission) dès que la page perso n'a pas de portrait. Résultat : une
  // grille où sept visages sont identiques. Le garde d'écriture est posé depuis
  // le 2026-08-21 ; ce check compte ce qui reste à nettoyer.
  {
    const owners = new Map<string, string[]>()
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase
        .from('members')
        .select('stage_name, photo_source_key, groups!inner(name)')
        .not('photo_source_key', 'is', null)
        .neq('photo_source_key', 'admin')
        .range(from, from + 999)
      if (!page || page.length === 0) break
      for (const m of page) {
        const key = m.photo_source_key as string
        const label = `${m.stage_name} (${(m.groups as { name: string }).name})`
        owners.set(key, [...(owners.get(key) ?? []), label])
      }
      if (page.length < 1000) break
    }
    const shared = [...owners.entries()]
      .filter(([, list]) => list.length > 1)
      .sort((a, b) => b[1].length - a[1].length)
    checks.push({
      id: 'members_sharing_photo',
      label: 'Membres partageant la même photo (photo de groupe / pochette)',
      severity: 'warn',
      count: shared.reduce((n, [, list]) => n + list.length, 0),
      sample: shared
        .slice(0, SAMPLE_MAX)
        .map(
          ([key, list]) =>
            `${list.length}× ${list.slice(0, 4).join(', ')} — ${key.split('/').pop()?.slice(0, 60)}`,
        ),
    })
  }

  // 1ter. Lien Spotify refusé par le garde de nom : rien n'a été écrit pour ce
  // groupe. C'est un ÉTAT à corriger à la main (lien mal seedé, ou alias hangul
  // manquant), plus un statut de run dégradé — sinon le monitor crie au loup
  // tous les jours (StelLive, 16–21/08).
  {
    // Le DERNIER run ne suffit pas : s'il s'est interrompu (quota Spotify), il
    // n'a comparé aucun nom et rapporterait « 0 mismatch » alors qu'on ne sait
    // simplement rien. On remonte au dernier run dont la phase 1 est allée au
    // bout (`aborted` null).
    const { data: runs } = await supabase
      .from('scrape_log')
      .select('details')
      .eq('source', 'refresh_images')
      .order('started_at', { ascending: false })
      .limit(10)
    const complete = (runs ?? [])
      .map((r) => ((r.details ?? {}) as Record<string, unknown>).images as Record<string, unknown>)
      .find((img) => img && img.aborted == null)
    const mismatches = Array.isArray(complete?.mismatches) ? (complete.mismatches as string[]) : []
    checks.push({
      id: 'spotify_link_mismatch',
      label: 'Liens Spotify refusés par le garde de nom',
      severity: 'warn',
      count: mismatches.length,
      sample: mismatches.slice(0, SAMPLE_MAX),
    })
  }

  // 2. Objets Storage surdimensionnés (>400 Ko), scindés référencés/orphelins
  // (2026-08-07 : le check comptait 23 orphelins jamais servis — signal pollué,
  // le remède reprocess-oversized-photos refusait à juste titre d'y toucher).
  // Référencé = pointé par members.photo_url ou groups.image_url → image
  // réellement servie trop lourde = pipeline cassé, à corriger vite.
  {
    const referenced = new Set<string>()
    const objectName = (url: string | null, bucket: string) => {
      if (!url) return null
      const marker = `/object/public/${bucket}/`
      const i = url.indexOf(marker)
      if (i === -1) return null
      return `${bucket}/${decodeURIComponent(url.slice(i + marker.length).split('?')[0])}`
    }
    for (const m of members ?? []) {
      const n = objectName(m.photo_url, 'member-photos')
      if (n) referenced.add(n)
    }
    for (const g of groups ?? []) {
      const n = objectName(g.image_url, 'group-photos')
      if (n) referenced.add(n)
    }
    const oversized = [
      ...(await listBucketOversized(supabase, 'member-photos')),
      ...(await listBucketOversized(supabase, 'group-photos')),
    ].sort((a, b) => b.size - a.size)
    const served = oversized.filter((o) => referenced.has(o.name))
    const orphans = oversized.filter((o) => !referenced.has(o.name))
    checks.push({
      id: 'oversized_photos',
      label: 'Objets Storage surdimensionnés SERVIS (>400 Ko, référencés)',
      severity: 'warn',
      count: served.length,
      sample: served.slice(0, SAMPLE_MAX).map((o) => `${o.name} — ${(o.size / 1e6).toFixed(2)} Mo`),
    })
    checks.push({
      id: 'oversized_orphans',
      label:
        'Objets Storage surdimensionnés orphelins (déchet, purge via reprocess --purge-orphans)',
      severity: 'info',
      count: orphans.length,
      sample: orphans
        .slice(0, SAMPLE_MAX)
        .map((o) => `${o.name} — ${(o.size / 1e6).toFixed(2)} Mo`),
    })
  }

  // 2 bis. URLs d'images MORTES, échantillonnées par colonne (audit 2026-08-20 :
  // 18/90 maxres YouTube en 404, détectées uniquement à l'œil jusqu'ici).
  // ~15 URLs random par colonne + les maxres des 15 MVs les plus récents (les
  // héros home//mvs les construisent depuis le videoId).
  {
    const pick = <T>(rows: readonly T[], n: number): T[] => {
      const a = [...rows]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a.slice(0, n)
    }
    const { data: recentMvs } = await supabase
      .from('events')
      .select('source_url')
      .eq('type', 'mv')
      .eq('hidden', false)
      .order('start_at', { ascending: false })
      .limit(DEAD_URL_SAMPLE)
    const ytId = (u: string | null) =>
      u?.match(/(?:youtu\.be\/|[?&]v=|\/embed\/)([\w-]{11})/)?.[1] ?? null
    const samples: { url: string; label: string }[] = [
      ...pick(
        (groups ?? []).filter((g) => g.image_url),
        DEAD_URL_SAMPLE,
      ).map((g) => ({
        url: g.image_url!,
        label: `groups.image_url (${g.slug})`,
      })),
      ...pick(
        (groups ?? []).filter((g) => g.image_landscape),
        DEAD_URL_SAMPLE,
      ).map((g) => ({
        url: g.image_landscape!,
        label: `groups.image_landscape (${g.slug})`,
      })),
      ...pick(
        (groups ?? []).filter((g) => g.banner_yt_url),
        DEAD_URL_SAMPLE,
      ).map((g) => ({
        url: g.banner_yt_url!,
        label: `groups.banner_yt_url (${g.slug})`,
      })),
      ...pick(
        (members ?? []).filter((m) => m.photo_url),
        DEAD_URL_SAMPLE,
      ).map((m) => ({ url: m.photo_url!, label: `members.photo_url (${m.slug ?? m.id})` })),
      ...(recentMvs ?? [])
        .map((e) => ytId(e.source_url))
        .filter((id): id is string => id !== null)
        .map((id) => ({
          url: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
          label: 'mv maxres (héros)',
        })),
    ]
    const dead = await sampleDeadImageUrls(samples)
    checks.push({
      id: 'dead_image_urls',
      label: `URLs d'images mortes (échantillon ${samples.length} testées)`,
      severity: 'warn',
      count: dead.length,
      sample: dead.slice(0, SAMPLE_MAX),
    })
  }

  // 3. Catalogues MV maigres (groupes actifs non dissous, ≤ THIN_MV_THRESHOLD).
  // Les débuts < 90 j sont SÉPARÉS (info) : leur catalogue fin est légitime —
  // mélangés, le compteur montait mécaniquement à chaque vague de debuts et
  // masquait le vrai retard (audit 2026-08-20 : 16/109 étaient des rookies).
  {
    const countByGroup = new Map<string, number>()
    for (const r of mvRows) {
      if (r.group_id && r.type === 'mv')
        countByGroup.set(r.group_id, (countByGroup.get(r.group_id) ?? 0) + 1)
    }
    const recentDebutCutoff = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10)
    // Les groupes DORMANTS (aucune sortie depuis > 24 mois) sortent du compteur
    // « catalogue maigre » (2026-08-21) : un artiste en pause depuis trois ans
    // avec 2 MV n'est pas un défaut de scraping, c'est son catalogue réel. Les
    // y compter gonflait l'alerte et noyait les vrais retards.
    const lastReleaseByGroup = new Map<string, string>()
    for (const r of mvRows) {
      if (!r.group_id) continue
      const cur = lastReleaseByGroup.get(r.group_id)
      if (!cur || r.start_at > cur) lastReleaseByGroup.set(r.group_id, r.start_at)
    }
    const isDormant = (id: string) =>
      activityStatus(lastReleaseByGroup.get(id), now.getTime()) === 'dormant'

    const allThin = (groups ?? [])
      .filter((g) => !g.disbanded_on && !isDormant(g.id))
      .map((g) => ({ g, n: countByGroup.get(g.id) ?? 0 }))
      .filter(({ n }) => n <= THIN_MV_THRESHOLD)
      .sort((a, b) => a.n - b.n)
    const rookies = allThin.filter(({ g }) => g.debut_date && g.debut_date >= recentDebutCutoff)
    const thin = allThin.filter(({ g }) => !(g.debut_date && g.debut_date >= recentDebutCutoff))
    // Un rookie à catalogue fin est normal ; un groupe DÉJÀ DÉBUTÉ à ZÉRO MV
    // ne l'est pas (retour Rudy 2026-08-21 : « un groupe qui a fait ses débuts
    // a au moins un MV » — vrai, cas OURBIRTHDAY dont le MV vivait sur la
    // chaîne JYP). Les pre-debut (date future) restent hors compte.
    const today = now.toISOString().slice(0, 10)
    const debutedNoMv = rookies.filter(
      ({ g, n }) => n === 0 && g.debut_date && g.debut_date <= today,
    )
    const stillBuilding = rookies.filter((r) => !debutedNoMv.includes(r))
    checks.push({
      id: 'debuted_without_mv',
      label: `Groupes DÉBUTÉS sans aucun MV — anormal (le MV est souvent sur la chaîne du label)`,
      severity: 'warn',
      count: debutedNoMv.length,
      sample: debutedNoMv
        .slice(0, SAMPLE_MAX)
        .map(({ g }) => `${g.name} (${g.slug}) — debut ${g.debut_date}`),
    })
    checks.push({
      id: 'thin_rookies',
      label: `Rookies (< 90 j) avec 1+ MV — catalogue en construction, normal`,
      severity: 'info',
      count: stillBuilding.length,
      sample: stillBuilding
        .slice(0, SAMPLE_MAX)
        .map(({ g, n }) => `${g.name} (${g.slug}) — ${n} MV`),
    })
    checks.push({
      id: 'thin_mv_catalogs',
      label: `Groupes à catalogue MV maigre (≤${THIN_MV_THRESHOLD}, hors debuts < 90 j)`,
      severity: 'warn',
      count: thin.length,
      sample: thin.slice(0, SAMPLE_MAX).map(({ g, n }) => `${g.name} (${g.slug}) — ${n} MV`),
    })
  }

  // 3bis. MV publiés dont le TITRE ne passe plus le filtre courant.
  //
  // Le gate ne s'applique qu'à l'ingestion : tout ce qui est entré sous une
  // version antérieure y reste. C'est ainsi que « [Beh!nd Un!corn] … MV
  // shooting » s'affichait comme un clip (retour Rudy 2026-08-21) — le « i »
  // de Behind est un « ! », la règle ne le voyait pas. Ce check rend visible
  // le résidu à chaque renforcement du filtre, au lieu d'attendre qu'un
  // utilisateur tombe dessus.
  {
    const suspects: string[] = []
    let scanned = 0
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase
        .from('events')
        .select('title, slug, groups!inner(name)')
        .eq('type', 'mv')
        .eq('hidden', false)
        .range(from, from + 999)
      if (!page || page.length === 0) break
      scanned += page.length
      for (const e of page) {
        const check = isOfficialMvTitle(e.title)
        if (check.official) continue
        suspects.push(
          `${(e.groups as { name: string }).name} — ${check.reason} — ${e.title.slice(0, 70)}`,
        )
      }
      if (page.length < 1000) break
    }
    checks.push({
      id: 'mv_title_rejected',
      label: `MV publiés que le filtre de titre rejette (${scanned} scannés)`,
      severity: 'warn',
      count: suspects.length,
      sample: suspects.slice(0, SAMPLE_MAX),
    })
  }

  // 4. Lineup unmatched en attente.
  {
    const { data, count } = await supabase
      .from('lineup_unmatched')
      .select('display_name, occurrences, shows', { count: 'exact' })
      .eq('status', 'pending')
      .order('occurrences', { ascending: false })
      .limit(SAMPLE_MAX)
    checks.push({
      id: 'lineup_unmatched_pending',
      label: 'Artistes de lineup hors roster (pending)',
      severity: 'info',
      count: count ?? 0,
      sample: (data ?? []).map(
        (r) => `${r.display_name} — ×${r.occurrences} (${(r.shows ?? []).join(', ')})`,
      ),
    })
  }

  // 5+6. Épisodes : non numérotés (passés/imminents) + conflits de numérotation.
  {
    const { data: episodes } = await supabase
      .from('show_episodes')
      .select('show_title, kst_day, episode_number')
    const rows = (episodes ?? []) as EpisodeRow[]
    const unnumbered = rows
      .filter((e) => e.episode_number == null && e.kst_day <= today)
      .sort((a, b) => a.kst_day.localeCompare(b.kst_day))
    checks.push({
      id: 'episodes_unnumbered',
      label: 'Épisodes diffusés sans numéro',
      severity: 'warn',
      count: unnumbered.length,
      sample: unnumbered.slice(0, SAMPLE_MAX).map((e) => `${e.show_title} — ${e.kst_day}`),
    })
    const conflicts = findNumberingConflicts(rows)
    checks.push({
      id: 'episode_numbering_conflicts',
      label: 'Numérotation d’épisodes contradictoire',
      severity: 'warn',
      count: conflicts.length,
      sample: conflicts.slice(0, SAMPLE_MAX),
    })

    // Régularité : une semaine sans épisode, hors préemption officielle.
    const { data: preemptions } = await supabase
      .from('show_preemptions')
      .select('show_title, kst_day')
    const since = new Date(now.getTime() - 91 * 86_400_000).toISOString().slice(0, 10)
    const missing = findMissingEpisodes(
      rows,
      new Set((preemptions ?? []).map((p) => `${p.show_title}|${p.kst_day}`)),
      // Seuls les shows RÉELLEMENT hebdomadaires : The Show ne diffuse plus
      // toutes les semaines (cf. ShowDescriptor.weekly).
      SHOW_DESCRIPTORS.filter((d) => d.weekly).map((d) => ({
        showTitle: d.displayName,
        weekday: d.slot.weekday,
      })),
      since,
      today,
    )
    // Jours KST qui portent au moins un passage. Pagination explicite : plus
    // de 700 rows music_show sur 13 semaines, et PostgREST plafonne à 1 000.
    const eventDays = new Set<string>()
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase
        .from('events')
        .select('title, start_at')
        .eq('type', 'music_show')
        // Un épisode dont tous les passages sont masqués est vide côté user.
        .eq('hidden', false)
        .range(from, from + 999)
      if (!page || page.length === 0) break
      for (const e of page) {
        const kst = new Date(Date.parse(e.start_at) + 9 * 3600_000).toISOString().slice(0, 10)
        eventDays.add(`${e.title}|${kst}`)
      }
      if (page.length < 1000) break
    }

    // Épisode en base auquel aucun passage n'est rattaché : une row fantôme
    // (The Show 18/08 portait #397, déjà attribué au 11/08 par l'autorité) —
    // elle produit une page /show vide et fausse la numérotation.
    const empty = rows.filter(
      (e) => e.kst_day <= today && !eventDays.has(`${e.show_title}|${e.kst_day}`),
    )
    checks.push({
      id: 'empty_episodes',
      label: 'Épisodes sans aucun passage',
      severity: 'warn',
      count: empty.length,
      sample: empty.slice(0, SAMPLE_MAX).map((e) => `${e.show_title} — ${e.kst_day}`),
    })

    checks.push({
      id: 'episodes_missing',
      label: 'Épisodes diffusés jamais collectés (trou de numérotation)',
      severity: 'warn',
      count: missing.length,
      sample: missing.slice(0, SAMPLE_MAX),
    })
  }

  // Passages annoncés qu'aucune vidéo du diffuseur ne confirme — relevés par
  // le dernier run `aired-shows`. Deux causes possibles (lineup prévisionnel
  // non réalisé, ou alias manquant) : revue humaine, jamais de purge auto.
  {
    const { data: lastRun } = await supabase
      .from('scrape_log')
      .select('details')
      .eq('source', 'aired_shows')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const details = (lastRun?.details ?? {}) as Record<string, unknown>
    const unconfirmed = Array.isArray(details.unconfirmed) ? (details.unconfirmed as string[]) : []
    checks.push({
      id: 'episodes_unconfirmed_lineup',
      label: 'Passages annoncés sans trace de diffusion',
      severity: 'warn',
      count:
        typeof details.unconfirmed_count === 'number'
          ? details.unconfirmed_count
          : unconfirmed.length,
      sample: unconfirmed.slice(0, SAMPLE_MAX),
    })
  }

  // 7. Stages manquants après fermeture de la fenêtre d'enrichissement.
  {
    const { data: shows } = await supabase
      .from('events')
      .select('title, start_at, stage_url')
      .eq('type', 'music_show')
      .eq('hidden', false)
      .lt('start_at', new Date(now.getTime() - STAGE_WINDOW_DAYS * 86_400_000).toISOString())
    const byEpisode = new Map<string, { total: number; withStage: number }>()
    for (const e of shows ?? []) {
      const key = `${e.title} ${e.start_at.slice(0, 10)}`
      const cur = byEpisode.get(key) ?? { total: 0, withStage: 0 }
      cur.total++
      if (e.stage_url) cur.withStage++
      byEpisode.set(key, cur)
    }
    const incomplete = [...byEpisode.entries()]
      .filter(([, v]) => v.withStage < v.total)
      .sort((a, b) => b[0].localeCompare(a[0]))
    checks.push({
      id: 'episodes_missing_stages',
      label: 'Épisodes diffusés avec stages manquants (fenêtre fermée)',
      severity: 'warn',
      count: incomplete.length,
      sample: incomplete
        .slice(0, SAMPLE_MAX)
        .map(([k, v]) => `${k} — ${v.withStage}/${v.total} stages`),
    })
  }

  // 8. Titres placeholder « X debut » proches de leur date (fenêtre ±30 j) :
  // le vrai nom du single est probablement annoncé, l'upgrade n'a pas suivi.
  {
    const since = new Date(now.getTime() - 30 * 86_400_000).toISOString()
    const until = new Date(now.getTime() + 30 * 86_400_000).toISOString()
    const { data: releases } = await supabase
      .from('events')
      .select('title, start_at, groups!inner(name)')
      .eq('type', 'release')
      .eq('hidden', false)
      .gte('start_at', since)
      .lte('start_at', until)
    // Deux formes de placeholder : « {groupe} debut » (ingest debuts) ET le
    // descripteur de format de kpopofficial, « NCT 127 7th Full Album (2026) »,
    // qui attend que le label revele le nom (retour Rudy 2026-08-22).
    const placeholders = (releases ?? []).filter((e) =>
      isPlaceholderRelease(e.title, (e.groups as { name: string }).name),
    )
    checks.push({
      id: 'placeholder_titles',
      label: 'Releases sans vrai titre (placeholder ou descripteur de format, ±30 j)',
      severity: 'warn',
      count: placeholders.length,
      sample: placeholders
        .slice(0, SAMPLE_MAX)
        .map((e) => `${e.title} — ${e.start_at.slice(0, 10)}`),
    })
  }

  // 9. Groupes pre-debut / fraîchement débutés avec roster squelettique (≤2).
  {
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86_400_000).toISOString().slice(0, 10)
    const memberCount = new Map<string, number>()
    for (const m of members ?? []) {
      memberCount.set(m.group_id, (memberCount.get(m.group_id) ?? 0) + 1)
    }
    const skeletal = (groups ?? [])
      .filter((g) => !g.is_solo && !g.disbanded_on && g.debut_date && g.debut_date >= sixtyDaysAgo)
      .map((g) => ({ g, n: memberCount.get(g.id) ?? 0 }))
      .filter(({ n }) => n <= 2)
    checks.push({
      id: 'predebut_incomplete',
      label: 'Groupes (pre)debut récents à roster squelettique (≤2 membres)',
      severity: 'warn',
      count: skeletal.length,
      sample: skeletal
        .slice(0, SAMPLE_MAX)
        .map(({ g, n }) => `${g.name} (${g.slug}) — ${n} membre(s), debut ${g.debut_date}`),
    })
  }

  // 10. Sources muettes (>48 h sans scrape). Restreint à youtube_api : les
  // autres types (community, music shows agrégés) ne stampent pas
  // last_scraped_at par design — les inclure = bruit permanent (vérifié sur
  // prod au premier run : « community suggestions — jamais »).
  {
    const cutoff = new Date(now.getTime() - 48 * 3_600_000).toISOString()
    const { data: sources } = await supabase
      .from('sources')
      .select('name, last_scraped_at')
      .eq('type', 'youtube_api')
      .or(`last_scraped_at.is.null,last_scraped_at.lt.${cutoff}`)
      .limit(1000)
    checks.push({
      id: 'stale_sources',
      label: 'Sources sans scrape depuis >48 h',
      severity: 'warn',
      count: (sources ?? []).length,
      sample: (sources ?? [])
        .slice(0, SAMPLE_MAX)
        .map((s) => `${s.name} — ${s.last_scraped_at ?? 'jamais'}`),
    })
  }

  // 10-bis. Solistes sans membre Soloist + agences avec wikitext résiduel
  // (incident Yuqi/Yves 2026-08-20) : un groupe is_solo SANS membre
  // position='Soloist' n'a ni page /artists, ni onglet Solo, ni career ; une
  // agency avec `'''` = champ fandom collé sans parseAgency.
  {
    const { data: solos } = await supabase
      .from('groups')
      .select('slug, name, is_solo, members(position)')
      .eq('is_solo', true)
      .limit(1000)
    const broken = (solos ?? []).filter(
      (g) => !(g.members ?? []).some((m) => m.position === 'Soloist'),
    )
    checks.push({
      id: 'solo_without_soloist_member',
      label: 'Solistes sans membre Soloist (pas de page artiste/career)',
      severity: 'warn',
      count: broken.length,
      sample: broken.slice(0, SAMPLE_MAX).map((g) => `${g.name} (${g.slug})`),
    })

    const { data: badAgencies } = await supabase
      .from('groups')
      .select('slug, agency')
      .like('agency', "%'''%")
      .limit(100)
    checks.push({
      id: 'agency_wikitext_residue',
      label: 'Agences avec wikitext résiduel (parsing fandom)',
      severity: 'warn',
      count: (badAgencies ?? []).length,
      sample: (badAgencies ?? []).slice(0, SAMPLE_MAX).map((g) => `${g.slug} — ${g.agency}`),
    })

    // Membre parasite dans une page solo (nuit 2026-08-21) : un artiste solo
    // n'a QUE son membre `Soloist`. Toute autre row est un artefact — le plus
    // souvent le GROUPE dont il fait partie, importé à l'envers depuis
    // MusicBrainz, avec la date de formation en guise d'anniversaire
    // (« WJSN CHOCOME » né le 2020-09-23 sur la page de Dayoung).
    const { data: soloRosters } = await supabase
      .from('groups')
      .select('slug, members(slug, stage_name, position)')
      .eq('is_solo', true)
      .limit(1000)
    const soloExtras = (soloRosters ?? []).flatMap((g) =>
      (g.members ?? [])
        .filter((m) => m.position !== 'Soloist')
        .map((m) => `${m.stage_name} (${m.slug ?? '?'}) sur /artists/${g.slug}`),
    )
    checks.push({
      id: 'solo_extra_members',
      label: 'Membres parasites sur une page solo (groupe importé comme personne)',
      severity: 'warn',
      count: soloExtras.length,
      sample: soloExtras.slice(0, SAMPLE_MAX),
    })

    // Membres sans slug (nuit 2026-08-21) : sans slug, member-card ne rend
    // aucun lien, la recherche filtre la personne et le sitemap l'ignore — 40
    // idols étaient injoignables (rosters entiers de NCT 127, NCT DREAM,
    // Hearts2Hearts, izna, QWER, plus G-Dragon). Invisible de tout autre check.
    const noSlug = (members ?? []).filter((m) => !m.slug)
    checks.push({
      id: 'members_without_slug',
      label: 'Membres sans slug — aucune page, absents de la recherche et du sitemap',
      severity: 'warn',
      count: noSlug.length,
      sample: noSlug.slice(0, SAMPLE_MAX).map((m) => m.stage_name),
    })

    // Noms de personnes au format sort-name (nuit 2026-08-21) : « Park,
    // Han-bin » vient de MusicBrainz, s'affiche tel quel sur les pages
    // membres, et signale presque toujours un DOUBLON de la même personne
    // déjà présente sous son stage name (EVNNE : 9 rows pour 5 membres).
    // Aucune photo fandom ne peut être trouvée pour un tel nom.
    const sortNamed = (members ?? []).filter((m) => /^[^,]+,\s+\S/.test(m.stage_name))
    checks.push({
      id: 'member_sort_names',
      label: 'Membres au format « Nom, Prénom » (doublon MusicBrainz probable)',
      severity: 'warn',
      count: sortNamed.length,
      sample: sortNamed.slice(0, SAMPLE_MAX).map((m) => `${m.stage_name} (${m.slug})`),
    })

    // Check INVERSE (review 2026-08-20) : un groupe non-solo à 0 membre =
    // soit un vrai soliste au kind fandom irrésolu (créé en groupe par
    // défaut), soit un roster jamais parsé — dans les deux cas une dette à
    // revoir, invisible du check solo_without_soloist_member (is_solo=true).
    const { data: nonSolo } = await supabase
      .from('groups')
      .select('slug, name, is_solo, members(id)')
      .eq('is_solo', false)
      .limit(1000)
    const memberless = (nonSolo ?? []).filter((g) => (g.members ?? []).length === 0)
    checks.push({
      id: 'groups_without_members',
      label: 'Groupes (non-solo) sans aucun membre — soliste raté ou roster manquant',
      severity: 'info',
      count: memberless.length,
      sample: memberless.slice(0, SAMPLE_MAX).map((g) => `${g.name} (${g.slug})`),
    })
  }

  // 11. Erreurs scrape_log récentes (48 h).
  {
    const since = new Date(now.getTime() - 48 * 3_600_000).toISOString()
    const { data: logs } = await supabase
      .from('scrape_log')
      .select('source, status, started_at, error_msg')
      .neq('status', 'ok')
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(100)
    checks.push({
      id: 'scrape_errors_recent',
      label: 'Runs scraper non-ok (48 h)',
      severity: 'info',
      count: (logs ?? []).length,
      sample: (logs ?? [])
        .slice(0, SAMPLE_MAX)
        .map((l) => `${l.source} ${l.status} — ${l.started_at.slice(0, 16)} ${l.error_msg ?? ''}`),
    })
  }

  // 12. Personnes dupliquées cross-groupe non liées (canonical_id NULL des 2 côtés).
  {
    const rows: MemberRow[] = (members ?? []).map((m) => ({
      id: m.id,
      slug: m.slug ?? '',
      stage_name: m.stage_name,
      real_name: m.real_name,
      birthday: m.birthday,
      canonical_id: m.canonical_id,
      group_id: m.group_id,
      group_name: (m.groups as { name: string }).name,
    }))
    const dups = findDuplicatePersonCandidates(rows)
    checks.push({
      id: 'duplicate_person_candidates',
      label: 'Personnes en double cross-groupe (non canonical-liées)',
      severity: 'warn',
      count: dups.length,
      sample: dups.slice(0, SAMPLE_MAX),
    })
  }

  // 13. Boucle de notification MORTE (2026-08-23).
  //
  // Les 28 checks précédents regardent la DONNÉE ; aucun ne regardait la
  // plomberie. Constaté en prod : `push_subscriptions` vidée sans que le code
  // d'envoi l'ait fait (`removed: 0` partout), les crons tournant « ok » avec
  // `candidates: 0` — un succès qui ne dit rien, et une panne muette pendant
  // deux jours. Un abonné qui disparaît doit se voir.
  {
    const { count: subs } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
    const sinceIso = new Date(now.getTime() - 7 * 24 * 3_600_000).toISOString()
    const { data: sendRuns } = await supabase
      .from('scrape_log')
      .select('source, started_at, details')
      .in('source', ['send_digest', 'notify_comebacks'])
      .gte('started_at', sinceIso)
      .order('started_at', { ascending: false })
      .limit(30)

    const runs = sendRuns ?? []
    const lastSend = runs.find((r) => {
      const d = r.details as { sent?: number } | null
      return (d?.sent ?? 0) > 0
    })
    // Une file vide alors que des envois ont réussi dans la semaine = les
    // abonnements ont disparu entre deux runs. Sans abonné DEPUIS TOUJOURS,
    // il n'y a rien à signaler : personne n'a encore activé les notifs.
    const brokeRecently = (subs ?? 0) === 0 && Boolean(lastSend)
    checks.push({
      id: 'push_loop_dead',
      label: "Boucle push sans abonné alors qu'elle envoyait encore",
      severity: 'warn',
      count: brokeRecently ? 1 : 0,
      sample: brokeRecently
        ? [
            `push_subscriptions = 0 ; dernier envoi réussi : ${lastSend!.source} ${lastSend!.started_at.slice(0, 16)}`,
            `runs d'envoi sur 7 j : ${runs.length} (tous à candidates: 0 depuis)`,
          ]
        : [],
    })
  }

  // 14. Erreurs serveur des 24 h (2026-08-23).
  //
  // `scrape_errors_recent` ne regarde que les crons ; une exception dans une
  // page ou une server action n'apparaissait nulle part. Pas d'agrégat par
  // route : à trois comptes il n'y a rien à agréger, l'échantillon brut est
  // plus utile qu'un top.
  {
    const since = new Date(now.getTime() - 24 * 3_600_000).toISOString()
    const { data: errors } = await supabase
      .from('error_log')
      .select('message, path, route_type, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50)
    const rows = errors ?? []
    checks.push({
      id: 'server_errors_24h',
      label: 'Erreurs serveur (24 h)',
      severity: 'warn',
      count: rows.length,
      sample: rows
        .slice(0, 5)
        .map(
          (e) =>
            `${e.created_at.slice(5, 16)} ${e.route_type ?? '?'} ${e.path ?? '?'} — ${e.message.slice(0, 120)}`,
        ),
    })
  }

  // 15. Couverture des métadonnées de groupe (2026-08-23).
  //
  // `agency` vient du scraper de debuts, qui ne visite QUE les nouveaux
  // groupes : la couverture était à l'envers (97/106 rookies contre 5/41
  // vétérans). Sans ce check, elle re-pourrit au fil des ajouts manuels et
  // personne ne le voit — la page d'un groupe culte affiche « debut 2013 » nu
  // pendant qu'un rookie inconnu affiche son agence.
  // `info` : c'est un backlog de complétude, pas un incident.
  {
    const { data: metaRows } = await supabase
      .from('groups')
      .select('name, agency, fandom_name, debut_date')
      .eq('is_solo', false)
      .is('disbanded_on', null)
      .neq('confidence', 'candidate')
    const rows = metaRows ?? []
    const missing = rows.filter((g) => !g.agency?.trim())
    checks.push({
      id: 'group_meta_coverage',
      label: 'Groupes sans agence',
      severity: 'info',
      count: missing.length,
      sample: missing
        .slice(0, SAMPLE_MAX)
        .map((g) => `${g.name}${g.debut_date ? ` (debut ${g.debut_date.slice(0, 4)})` : ''}`),
    })
  }

  return { generatedAt: nowIso, checks }
}

/** Résumé compact pour scrape_log.details (counts par check). */
export function summarizeReport(report: DataHealthReport): Record<string, number> {
  return Object.fromEntries(report.checks.map((c) => [c.id, c.count]))
}
