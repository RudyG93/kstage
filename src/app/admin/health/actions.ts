'use server'

import { after } from 'next/server'
import { headers } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  CRON_LOG_SOURCE,
  REMEDY_COOLDOWN_MIN,
  summarizeRun,
  TRIGGERABLE_CRONS,
  type TriggerableCron,
} from '@/lib/health/remedies'
import type { Database } from '@/types/database'

/**
 * Déclenche un cron RÉPARATEUR depuis /admin/health (Lot 5 peaufinage
 * 2026-08-20). Liste fermée (jamais les crons d'envoi de notifs), garde
 * admin, et le run part en `after()` : la réponse revient tout de suite,
 * le cron (jusqu'à 300 s) tourne après la réponse — même mécanique
 * d'autorisation que GitHub Actions (Bearer CRON_SECRET).
 */
export async function triggerRemedyCron(
  cron: TriggerableCron,
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }
  if (!TRIGGERABLE_CRONS.includes(cron)) return { error: 'Unknown cron.' }
  const secret = process.env.CRON_SECRET
  if (!secret) return { error: 'CRON_SECRET missing.' }

  // Origin du déploiement COURANT (pas SITE_URL) : en local/preview, le bouton
  // doit déclencher CE serveur, jamais la prod.
  // COOLDOWN — le même cron ne se rejoue pas à volonté. Cinq relances à la
  // main le 2026-08-20 ont porté la consommation YouTube à 11 889 units, soit
  // au-dessus du quota gratuit. Le dernier run fait foi, qu'il vienne du
  // planificateur ou d'un clic : rejouer un cron qui vient de tourner ne peut
  // rien apporter de neuf, seulement coûter.
  const attente = await minutesAvantRejeu(cron)
  if (attente > 0) {
    return {
      error:
        attente >= 60
          ? `Ce cron vient de tourner. Réessayer dans ${Math.ceil(attente / 60)} h.`
          : `Ce cron vient de tourner. Réessayer dans ${attente} min.`,
    }
  }

  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('host')
  if (!host) return { error: 'Host header missing.' }

  after(async () => {
    try {
      const res = await fetch(`${proto}://${host}/api/cron/${cron}`, {
        headers: { authorization: `Bearer ${secret}` },
        // Un run peut durer plusieurs minutes (maxDuration 300 côté route).
        signal: AbortSignal.timeout(300_000),
      })
      console.log(`[admin-remedy] ${cron} → HTTP ${res.status}`)
    } catch (e) {
      console.error(`[admin-remedy] ${cron} failed: ${String(e)}`)
    }
  })
  return { ok: true }
}

/**
 * Minutes restantes avant qu'un nouveau déclenchement manuel soit permis.
 * 0 = disponible. Lit `scrape_log`, donc compte AUSSI les runs planifiés.
 */
export async function minutesAvantRejeu(cron: TriggerableCron): Promise<number> {
  const source = CRON_LOG_SOURCE[cron]
  const cooldown = REMEDY_COOLDOWN_MIN[cron]
  if (!source || !cooldown) return 0
  const supabase = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await supabase
    .from('scrape_log')
    .select('started_at')
    .eq('source', source)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.started_at) return 0
  const ecoule = (Date.now() - Date.parse(data.started_at)) / 60_000
  return Math.max(0, Math.ceil(cooldown - ecoule))
}

/**
 * Résultat du run déclenché par un bouton — le bouton l'interroge jusqu'à ce
 * qu'un run postérieur au clic apparaisse dans `scrape_log`. Sans cette boucle
 * de retour, un remède qui échouait (quota YouTube épuisé, aucune source à
 * traiter) affichait quand même « Lancé ✓ » : c'est précisément ce qui donnait
 * le sentiment que « quoi que je fasse, ça ne change rien ».
 */
export async function getRemedyRunResult(
  cron: TriggerableCron,
  sinceIso: string,
): Promise<{ done: boolean; summary?: string; status?: string; error?: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { done: false, error: gate.error }
  const source = CRON_LOG_SOURCE[cron]
  if (!source) return { done: false, error: 'Cron inconnu.' }

  const supabase = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await supabase
    .from('scrape_log')
    .select('source, status, started_at, ended_at, error_msg, details')
    .eq('source', source)
    .gte('started_at', sinceIso)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return { done: false }
  return {
    done: true,
    status: data.status,
    summary: summarizeRun(data.source, data.status, data.details, data.error_msg),
  }
}
