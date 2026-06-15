import { timingSafeEqual } from 'node:crypto'

/**
 * Garde commune des routes cron (Vercel envoie `Authorization: Bearer
 * ${CRON_SECRET}`). Centralisé (P1) pour :
 *  - refuser si `CRON_SECRET` est absent/vide — sinon le check inline
 *    `auth !== `Bearer ${undefined}`` laissait passer `Bearer undefined` ;
 *  - comparer en temps constant (anti timing).
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  // timingSafeEqual exige des longueurs égales (la longueur n'est pas secrète).
  return a.length === b.length && timingSafeEqual(a, b)
}
