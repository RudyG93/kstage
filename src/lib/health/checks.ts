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
import { isSamePerson, normalizeName } from '@/lib/members/matching'

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
      if (actual !== expected) {
        conflicts.push(
          `${show}: #${a.episode_number} (${a.kst_day}) → #${b.episode_number} (${b.kst_day}) — delta ${actual}, attendu ${expected} (${between} épisodes entre)`,
        )
      }
    }
  }
  return conflicts
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

async function fetchAllMvEvents(supabase: SupabaseClient) {
  const rows: { group_id: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('events')
      .select('group_id')
      .eq('type', 'mv')
      .eq('hidden', false)
      .range(from, from + 999)
    if (error) throw new Error(`events mv: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
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

  // Jeux partagés par plusieurs checks.
  const [{ data: groups }, { data: members }, mvRows] = await Promise.all([
    supabase.from('groups').select('id, name, slug, is_solo, debut_date, disbanded_on'),
    supabase
      .from('members')
      .select(
        'id, slug, stage_name, real_name, birthday, canonical_id, group_id, photo_url, status, groups!inner(name)',
      ),
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

  // 2. Objets Storage surdimensionnés (>400 Ko) — pipeline images cassé si ça remonte.
  {
    const oversized = [
      ...(await listBucketOversized(supabase, 'member-photos')),
      ...(await listBucketOversized(supabase, 'group-photos')),
    ].sort((a, b) => b.size - a.size)
    checks.push({
      id: 'oversized_photos',
      label: 'Objets Storage surdimensionnés (>400 Ko)',
      severity: 'warn',
      count: oversized.length,
      sample: oversized
        .slice(0, SAMPLE_MAX)
        .map((o) => `${o.name} — ${(o.size / 1e6).toFixed(2)} Mo`),
    })
  }

  // 3. Catalogues MV maigres (groupes actifs non dissous, ≤ THIN_MV_THRESHOLD).
  {
    const countByGroup = new Map<string, number>()
    for (const r of mvRows) {
      if (r.group_id) countByGroup.set(r.group_id, (countByGroup.get(r.group_id) ?? 0) + 1)
    }
    const thin = (groups ?? [])
      .filter((g) => !g.disbanded_on)
      .map((g) => ({ g, n: countByGroup.get(g.id) ?? 0 }))
      .filter(({ n }) => n <= THIN_MV_THRESHOLD)
      .sort((a, b) => a.n - b.n)
    checks.push({
      id: 'thin_mv_catalogs',
      label: `Groupes à catalogue MV maigre (≤${THIN_MV_THRESHOLD})`,
      severity: 'warn',
      count: thin.length,
      sample: thin.slice(0, SAMPLE_MAX).map(({ g, n }) => `${g.name} (${g.slug}) — ${n} MV`),
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
      label: 'Numérotation d’épisodes incohérente',
      severity: 'warn',
      count: conflicts.length,
      sample: conflicts.slice(0, SAMPLE_MAX),
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
      .gte('start_at', since)
      .lte('start_at', until)
    const placeholders = (releases ?? []).filter((e) =>
      isPlaceholderTitle(e.title, (e.groups as { name: string }).name),
    )
    checks.push({
      id: 'placeholder_titles',
      label: 'Releases au titre placeholder « X debut » (±30 j)',
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

  return { generatedAt: nowIso, checks }
}

/** Résumé compact pour scrape_log.details (counts par check). */
export function summarizeReport(report: DataHealthReport): Record<string, number> {
  return Object.fromEntries(report.checks.map((c) => [c.id, c.count]))
}
