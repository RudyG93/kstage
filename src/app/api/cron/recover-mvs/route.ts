import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { recoverMvsFromFandom } from '@/lib/scrapers/mv-recovery'
import { QuotaExceededError } from '@/lib/scrapers/youtube'
import { logScrapeRun, type ScrapeStatus } from '@/lib/scrapers/scrape-log'
import type { Database } from '@/types/database'

export const maxDuration = 300

/**
 * Récupération des MV manquants par la DISCOGRAPHIE fandom (nuit 2026-08-21).
 *
 * Remplace `discover-channels` comme moteur principal du drain des catalogues
 * maigres. Pourquoi : la découverte par `search.list` coûte ~205 units par
 * groupe sur un quota de RECHERCHE quotidien étroit (429 constaté le 21/08 —
 * les remèdes de /admin/health ne résolvaient donc rien), et elle ne trouve
 * qu'une chaîne, alors que les MV d'un groupe sont souvent éclatés sur celle
 * de son label (OURBIRTHDAY « SQUEEZY » sur JYP Entertainment).
 *
 * Ici : la page fandom d'une sortie cite le lien YouTube du MV quelle que soit
 * la chaîne. Coût ~2 units/groupe → on peut balayer TOUT le pool en un run.
 * Mesure de la première passe : 123 MVs récupérés sur 25 groupes pour 205
 * units au total (WayV 0→20, chungha 5→20, ZICO 4→17).
 */
const THIN_CATALOG_MVS = 5
// ~2 units/groupe : le budget YouTube n'a jamais été la contrainte ici (240
// units sur 10 000). C'est le TEMPS qui l'est : chaque groupe enchaîne
// plusieurs requêtes fandom séquentielles, et 120 groupes dépassaient les
// 300 s de `maxDuration`. Mesuré sur les runs planifiés du créneau 10:20 UTC :
// **3 échecs sur 4** — et un run tué n'écrit aucun `scrape_log`, donc l'échec
// était invisible jusqu'à ce qu'on compte les runs GitHub.
const MAX_GROUPS_PER_RUN = 20
// Butoir de TEMPS plutôt qu'un nombre magique : il s'ajuste tout seul quand la
// latence fandom bouge ou que le pool grossit. Le run s'arrête proprement,
// journalise ce qu'il a fait, et le reste part au run du lendemain — c'est un
// cron de rattrapage, rien n'y est urgent.
const BUDGET_MS = 230_000

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 500 })

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const startedAt = new Date().toISOString()

  // Groupes actifs à catalogue maigre, les plus démunis d'abord (un groupe à
  // 0 MV est une page vide pour un fan — c'est là que ça se voit).
  const targets: { id: string; slug: string; n: number; verifieLe: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('groups')
      .select('id, slug, disbanded_on, mv_recovery_checked_at, events(id, type, hidden)')
      .range(from, from + 999)
    if (error) break
    for (const g of data ?? []) {
      if (g.disbanded_on) continue
      const n = (g.events ?? []).filter((e) => e.type === 'mv' && !e.hidden).length
      if (n <= THIN_CATALOG_MVS)
        targets.push({ id: g.id, slug: g.slug, n, verifieLe: g.mv_recovery_checked_at })
    }
    if (!data || data.length < 1000) break
  }

  // ROTATION plutôt que fenêtre fixe. Le pool (89 groupes) tenait entièrement
  // sous l'ancien plafond de 120 : les MÊMES groupes étaient donc re-scannés
  // intégralement chaque jour, pour 0 à 3 insertions et ~95 % de refus stables
  // (« aucun MV nouveau retenu par les gates » : 72 à 84 groupes). C'est ce
  // volume qui a tué 3 runs sur 4 à 304 s contre un maxDuration de 300, les
  // requêtes fandom étant séquentielles.
  //
  // Une fenêtre « ne pas revoir avant N jours » aurait créé un autre défaut :
  // tous les horodatages étant posés le même jour, le cron aurait tout traité
  // d'un coup puis rien pendant N jours. La rotation, elle, étale le pool par
  // construction et son intervalle s'adapte : pool/MAX_GROUPS_PER_RUN jours,
  // soit ~4,5 jours aujourd'hui, sans jamais dépasser le budget de temps.
  //
  // Jamais vérifiés d'abord, puis les plus anciennement vérifiés ; à égalité,
  // le catalogue le plus maigre passe devant — un groupe à 0 MV est une page
  // vide pour un fan, c'est là que ça se voit.
  targets.sort(
    (a, b) =>
      (a.verifieLe === null
        ? b.verifieLe === null
          ? 0
          : -1
        : b.verifieLe === null
          ? 1
          : a.verifieLe.localeCompare(b.verifieLe)) || a.n - b.n,
  )
  const batch = targets.slice(0, MAX_GROUPS_PER_RUN)

  const echeance = Date.now() + BUDGET_MS
  let inserted = 0
  let units = 0
  let tronqueParLeTemps = false
  let traites = 0
  let quotaExhausted = false
  const gains: Record<string, number> = {}
  const reasons: Record<string, number> = {}
  const marques: string[] = []

  for (const t of batch) {
    if (Date.now() > echeance) {
      tronqueParLeTemps = true
      break
    }
    traites++
    try {
      const res = await recoverMvsFromFandom(supabase, t.id, apiKey)
      inserted += res.inserted
      units += res.units
      if (res.inserted > 0) gains[t.slug] = res.inserted
      else if (res.reason) reasons[res.reason] = (reasons[res.reason] ?? 0) + 1
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        // Quota épuisé : on n'a RIEN demandé à fandom pour ce groupe, donc on
        // ne le marque pas — il doit rester en tête, pas repartir en fin de file.
        quotaExhausted = true
        break
      }
      reasons[String(e).slice(0, 80)] = (reasons[String(e).slice(0, 80)] ?? 0) + 1
    }
    // Marqué à CHAQUE tentative, succès ou échec : c'est l'horodatage qui fait
    // tourner la file. Ne marquer que les succès ramènerait indéfiniment en
    // tête les groupes qui échouent — le défaut corrigé le même jour sur
    // `image_checked_at`, où 95 groupes bloquaient la fenêtre pour toujours.
    marques.push(t.id)
  }
  if (marques.length > 0) {
    const { error } = await supabase
      .from('groups')
      .update({ mv_recovery_checked_at: new Date().toISOString() })
      .in('id', marques)
    if (error) console.error(`recover-mvs: horodatage échoué — ${error.message}`)
  }

  // Une troncature par le temps n'est PAS un échec : le pool est traité en
  // plusieurs jours. Seul le quota épuisé mérite `partial`.
  const status: ScrapeStatus = quotaExhausted ? 'partial' : 'ok'
  await logScrapeRun(supabase, {
    source: 'recover_mvs',
    status,
    startedAt,
    errorMsg: quotaExhausted ? 'quota YouTube épuisé — run tronqué' : null,
    details: {
      scanned: traites,
      truncatedByTime: tronqueParLeTemps,
      // `pool` = tous les groupes à catalogue maigre ; `batchSize` = ce que la
      // rotation en prend ce tour-ci. Le rapport des deux donne la période de
      // revisite en jours, lisible d'un coup d'œil dans le journal.
      remaining: Math.max(0, targets.length - traites),
      batchSize: batch.length,
      pool: targets.length,
      inserted,
      units,
      groupsImproved: Object.keys(gains).length,
      gains,
      reasons,
    },
  })

  return NextResponse.json({
    scanned: traites,
    truncatedByTime: tronqueParLeTemps,
    inserted,
    units,
    gains,
    reasons,
  })
}
