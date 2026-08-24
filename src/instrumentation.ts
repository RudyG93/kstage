import type { Instrumentation } from 'next'

/**
 * Journal des erreurs SERVEUR.
 *
 * L'app n'avait aucune visibilité sur ses erreurs de rendu : une exception dans
 * un Server Component, une Server Action ou un route handler partait dans les
 * logs Vercel — rétention courte, et aucun des 29 checks santé ne les lit. On
 * ne peut pas réparer ce qu'on ne voit pas.
 *
 * `onRequestError` (API stable Next 16) les capture toutes, quel que soit le
 * contexte (`render` | `route` | `action` | `proxy`).
 *
 * Trois précautions :
 *  - **best-effort, jamais throw** : une panne d'écriture du journal ne doit
 *    pas se superposer à l'erreur d'origine ;
 *  - **no-op sous `GITHUB_ACTIONS`** : la CI joue les golden paths contre la
 *    prod, ses erreurs volontaires (404 testés, formulaires invalides) ne sont
 *    pas des incidents ;
 *  - **aucune donnée personnelle** : ni IP, ni User-Agent, ni corps de requête.
 *    Le chemin peut porter une query — on le tronque à son pathname.
 */

/**
 * Ce qui n'est PAS une erreur serveur.
 *
 * « The destination stream closed early » = le visiteur a fermé l'onglet ou
 * navigué ailleurs pendant qu'une page streamait. C'est un comportement
 * normal, pas un incident — et sur les pages en Suspense c'est même fréquent.
 *
 * Non filtré, ça a rempli **517 lignes sur 517** du journal en 24 h : 100 % du
 * bruit, 0 % de signal. Le check `server_errors_24h` affichait donc un ambre
 * permanent qui ne voulait rien dire, et noyait ce qu'il fallait voir.
 */
const BRUIT_CLIENT = [
  'The destination stream closed early',
  'aborted',
  'ECONNRESET',
  'The user aborted a request',
]

const estDuBruit = (message: string) => BRUIT_CLIENT.some((m) => message.includes(m))
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.GITHUB_ACTIONS === 'true') return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  try {
    const message = err instanceof Error ? err.message : String(err)
    if (estDuBruit(message)) return
    const digest =
      typeof err === 'object' && err !== null && 'digest' in err ? String(err.digest) : null
    const stack = err instanceof Error ? (err.stack ?? null) : null

    await fetch(`${url}/rest/v1/error_log`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        message: message.slice(0, 2000),
        digest,
        // `request.path` porte la query string : on ne garde que le chemin,
        // une recherche ou un token de feed n'a rien à faire dans un journal.
        path: request.path.split('?')[0].slice(0, 500),
        route_path: context.routePath?.slice(0, 500) ?? null,
        route_type: context.routeType ?? null,
        method: request.method ?? null,
        stack: stack?.slice(0, 4000) ?? null,
      }),
    })
  } catch {
    // Le journal est un confort, pas un chemin critique.
  }
}
