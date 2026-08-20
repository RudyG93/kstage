'use server'

import { after } from 'next/server'
import { headers } from 'next/headers'
import { requireAdmin } from '@/lib/auth/require-admin'
import { TRIGGERABLE_CRONS, type TriggerableCron } from '@/lib/health/remedies'

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
