// Roster watch des groupes (pre)debut récents (round 2026-07-18, cas
// OURBIRTHDAY) : les rosters n'étaient capturés QU'À la création — un membre
// annoncé ensuite (reveal au compte-goutte des pre-debuts) n'arrivait jamais
// en base. Ici : re-scrape fandom APPEND-ONLY des groupes dont le debut est
// récent ou à venir, gardes strictes (diff par slug ET nom normalisé, max 5
// ajouts/groupe/run, jamais de delete/update). Rattaché au cron quotidien
// scrape-comebacks. Les nouveaux membres passent par le fill photo immédiat.
import type { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { refreshMemberPhotos } from '@/lib/images/refresh'
import { normalize } from '@/lib/scrapers/group-match'
import { fetchInfobox, searchPageIds } from './fandom'
import { slugify } from './ingest'

type SupabaseClient = ReturnType<typeof createClient<Database>>

const MAX_ADDITIONS_PER_GROUP = 5

export interface RosterWatchSummary {
  checked: number
  added: number
  misses: number
  blocked: boolean
  additions: string[]
  errors: string[]
}

/** Nettoie une entrée membre d'infobox (suffixe « (POSITION) » etc.). */
function cleanStage(raw: string): string {
  return raw.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

export async function refreshRecentRosters(
  supabase: SupabaseClient,
  opts: { windowDays?: number; maxGroups?: number } = {},
): Promise<RosterWatchSummary> {
  const windowDays = opts.windowDays ?? 30
  const maxGroups = opts.maxGroups ?? 10
  const summary: RosterWatchSummary = {
    checked: 0,
    added: 0,
    misses: 0,
    blocked: false,
    additions: [],
    errors: [],
  }

  // Cible : groupes (non solo, non dissous) dont le debut est dans ±windowDays
  // futurs inclus — c'est la fenêtre des reveals de membres.
  const floor = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10)
  const { data: groups, error } = await supabase
    .from('groups')
    .select('id, name, slug, debut_date')
    .eq('is_solo', false)
    .is('disbanded_on', null)
    .gte('debut_date', floor)
    .order('debut_date', { ascending: true })
    .limit(maxGroups)
  if (error) {
    summary.errors.push(`groups select: ${error.message}`)
    return summary
  }

  for (const group of groups ?? []) {
    summary.checked++
    try {
      const pageIds = await searchPageIds(group.name, 3)
      let infoboxMembers: string[] | null = null
      for (const pageid of pageIds) {
        const { infobox, blocked } = await fetchInfobox(pageid)
        if (blocked) {
          summary.blocked = true
          return summary
        }
        // La bonne page = même nom normalisé (une recherche peut renvoyer des
        // pages de membres ou d'homonymes en premier).
        if (infobox && normalize(infobox.name) === normalize(group.name)) {
          infoboxMembers = infobox.members
          break
        }
      }
      if (!infoboxMembers || infoboxMembers.length === 0) {
        summary.misses++
        continue
      }

      const { data: existing } = await supabase
        .from('members')
        .select('slug, stage_name')
        .eq('group_id', group.id)
      const existingSlugs = new Set((existing ?? []).map((m) => m.slug))
      const existingNames = new Set((existing ?? []).map((m) => normalize(m.stage_name)))

      const additions = infoboxMembers
        .map(cleanStage)
        .filter((stage) => stage.length > 0)
        .filter((stage) => {
          const slug = `${group.slug}-${slugify(stage)}`
          return !existingSlugs.has(slug) && !existingNames.has(normalize(stage))
        })
        .slice(0, MAX_ADDITIONS_PER_GROUP)

      if (additions.length === 0) continue
      const rows = additions.map((stage) => ({
        group_id: group.id,
        stage_name: stage,
        status: 'active' as const,
        slug: `${group.slug}-${slugify(stage)}`,
      }))
      const { error: insErr } = await supabase.from('members').insert(rows)
      if (insErr) {
        summary.errors.push(`${group.slug}: ${insErr.message}`)
        continue
      }
      summary.added += rows.length
      summary.additions.push(...rows.map((r) => r.slug))
      // Photos immédiates (best-effort) — même filet que createFromPayload.
      try {
        await refreshMemberPhotos(supabase, { groupId: group.id, batch: 10 })
      } catch {
        // La rotation quotidienne rattrapera.
      }
    } catch (e) {
      summary.errors.push(`${group.slug}: ${String(e)}`)
    }
  }
  return summary
}
