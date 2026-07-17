// Fetch partagé via r.jina.ai (Phase 3 Lot 4, « réduction du SPOF Jina »).
// Un fallback fetch-direct est inviable : les 5 parsers consomment le MARKDOWN
// Jina (réécrire 5 parsers HTML/JS ne réduit pas le risque, il le déplace).
// Réduction MINIMALE honnête :
//   - timeout explicite (AbortController) — un Jina qui pend ne bloque plus
//     le run entier jusqu'au timeout Vercel ;
//   - 1 retry avec backoff court — absorbe les 429/5xx transitoires ;
//   - clé API OPTIONNELLE (env JINA_API_KEY) — le tier payant a un rate-limit
//     et une fiabilité supérieurs ; zéro coût si absente ;
//   - erreurs préfixées `jina:` — scrape_log/monitor distinguent « Jina down »
//     de « site source down ». La panne totale est déjà détectée (0 lineup →
//     error → run GH rouge → email).

const DEFAULT_TIMEOUT_MS = 25_000
const RETRY_BACKOFF_MS = 3_000

export async function fetchViaJina(
  url: string,
  opts: { timeoutMs?: number; userAgent?: string } = {},
): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`
  const headers: Record<string, string> = {
    'user-agent': opts.userAgent ?? 'KStageBot/0.1 (+https://kstage.vercel.app)',
  }
  if (process.env.JINA_API_KEY) headers.authorization = `Bearer ${process.env.JINA_API_KEY}`

  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS))
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    try {
      const res = await fetch(jinaUrl, { headers, signal: controller.signal })
      if (!res.ok) {
        lastError = new Error(`jina: HTTP ${res.status} pour ${url}`)
        continue
      }
      return await res.text()
    } catch (err) {
      lastError = new Error(
        `jina: ${err instanceof Error && err.name === 'AbortError' ? `timeout ${opts.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms` : String(err)} pour ${url}`,
      )
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`jina: échec pour ${url}`)
}
