// Helpers Spotify Web API (client-credentials, server-only) pour les images
// d'artistes. R4-B (2026-07-13) : accès PAR ID uniquement, via links->>'spotify'
// seedé. La recherche par nom est SUPPRIMÉE : son repli aveugle `items[0]`
// écrivait n'importe quel homonyme (WEi → « Weird Al » Yankovic, vérifié en
// prod), et le cron hebdo re-corrompait toute réparation manuelle.
//
// Restrictions de l'app en dev-mode (vérifiées le 2026-08-21, cf.
// reference_spotify_api_restrictions) :
//   - `followers`/`popularity` ne sont plus exposés → colonne NULL ;
//   - **`GET /v1/artists?ids=` (batch) renvoie 403** — l'appel unitaire reste
//     le seul chemin, donc pas de regroupement possible pour économiser ;
//   - le quota est journalier : au-delà, 429 `QUOTA_EXCEEDED` avec un
//     `Retry-After` de plusieurs HEURES (47 486 s observées).

import { needleInTitle, normalize, tokenIndex } from '@/lib/scrapers/group-match'

/** Token client-credentials (sans login user). Null si les creds manquent. */
export async function spotifyToken(): Promise<string | null> {
  const id = process.env.SPOTIFY_CLIENT_ID
  const secret = process.env.SPOTIFY_CLIENT_SECRET
  if (!id || !secret) return null
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) return null
  return ((await res.json()) as { access_token?: string }).access_token ?? null
}

/** ID artiste depuis une URL open.spotify.com/artist/<id> (groups.links). */
export function parseSpotifyArtistId(url: string | null | undefined): string | null {
  if (!url) return null
  const m = /artist\/([A-Za-z0-9]+)/.exec(url)
  return m ? m[1] : null
}

export interface SpotifyArtistById {
  name: string
  /** Image canonique la plus grande (set officiel 640/320/160, carré). */
  image: string | null
  /** Null en app dev-mode (restriction 2026, cf. reference_spotify_api_restrictions). */
  followers: number | null
}

/**
 * Pourquoi un artiste n'a pas pu être lu. `fatal` = inutile de continuer la
 * boucle, tous les appels suivants échoueront de la même façon.
 *
 * L'ancienne signature renvoyait `null` pour TOUT non-2xx : un id mort, un
 * quota épuisé et un token invalide se comptaient dans le même `apiMisses`.
 * Conséquence mesurée le 2026-08-20 : un run où **166 appels sur 167** ont
 * échoué (quota) a été loggé `ok`, pendant qu'un run où un seul groupe portait
 * un nom coréen était loggé `partial`. Sévérité exactement inversée.
 */
export type SpotifyFailure =
  | { reason: 'not_found'; fatal: false }
  | { reason: 'server'; fatal: false }
  | { reason: 'malformed'; fatal: false }
  | { reason: 'rate_limited'; fatal: true; retryAfterSec: number | null }
  | { reason: 'auth'; fatal: true }

export type SpotifyArtistResult =
  { ok: true; artist: SpotifyArtistById } | { ok: false; failure: SpotifyFailure }

/** Artiste par ID — jamais d'ambiguïté d'homonyme, images carrées canoniques. */
export async function spotifyArtistById(id: string, token: string): Promise<SpotifyArtistResult> {
  let res: Response
  try {
    res = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return { ok: false, failure: { reason: 'server', fatal: false } }
  }
  if (!res.ok) {
    if (res.status === 429) {
      const raw = Number(res.headers.get('retry-after'))
      return {
        ok: false,
        failure: {
          reason: 'rate_limited',
          fatal: true,
          retryAfterSec: Number.isFinite(raw) ? raw : null,
        },
      }
    }
    // 403 en dev-mode = endpoint interdit à l'app, pas un id manquant : même
    // traitement que 401, inutile de dérouler les 166 groupes suivants.
    if (res.status === 401 || res.status === 403) {
      return { ok: false, failure: { reason: 'auth', fatal: true } }
    }
    if (res.status === 404) return { ok: false, failure: { reason: 'not_found', fatal: false } }
    return { ok: false, failure: { reason: 'server', fatal: false } }
  }
  const a = (await res.json().catch(() => null)) as {
    name?: string
    images?: { url: string; width: number }[]
    followers?: { total: number }
  } | null
  if (!a?.name) return { ok: false, failure: { reason: 'malformed', fatal: false } }
  return {
    ok: true,
    artist: {
      name: a.name,
      image: (a.images ?? []).slice().sort((x, y) => y.width - x.width)[0]?.url ?? null,
      followers: a.followers?.total ?? null,
    },
  }
}

/**
 * Garde de cohérence entre le nom en DB et le nom renvoyé par Spotify : un
 * lien mal seedé ne doit JAMAIS écrire d'image.
 *
 * `normalize` est celui de group-match (Unicode-aware) et NON une copie locale
 * ASCII-only. L'ancienne version faisait `replace(/[^a-z0-9]/g, '')`, donc
 * `norm('스텔라이브') === ''` — tout artiste au nom purement coréen était
 * structurellement impossible à matcher, et StelLive bloquait le cron en
 * `partial` depuis le 2026-08-16.
 *
 * Les `aliases` viennent de `groups.name_aliases` (migration 0061 : hangul
 * officiel, rebrand, membre facturé) — la table connaissait déjà « 스텔라이브 »,
 * personne ne le lui demandait. Ils remplacent le Record codé en dur qui ne
 * contenait que TXT, alias que la DB porte aussi.
 *
 * Deux façons de matcher, chacune née d'un cas réel :
 *   1. **mots entiers** du nom Spotify (`needleInTitle`) — couvre « i-dle » dans
 *      « (G)I-DLE » et « POW » dans « POW (파우 » ;
 *   2. **inclusion brute**, mais seulement à partir de 4 caractères — couvre
 *      « GENBLUE » dans « GENBLUE幻藍小熊 », où le suffixe est collé sans
 *      séparateur, donc sans frontière de mot exploitable.
 *
 * Le plancher n'est pas décoratif : `'wei'` est contenu dans `'weirdalyankovic'`.
 * L'inclusion sans plancher validait donc « WEi → “Weird Al” Yankovic » —
 * l'exemple même que ce garde est censé arrêter (test de non-régression).
 */
const MIN_SUBSTRING_LEN = 4

export function spotifyNameMatches(
  groupName: string,
  artistName: string,
  aliases: readonly string[] = [],
): boolean {
  const s = normalize(artistName)
  if (!s) return false
  const needles = [groupName, ...aliases].map(normalize).filter(Boolean)
  if (needles.length === 0) return false
  const index = tokenIndex(artistName)
  return needles.some(
    (n) =>
      n === s ||
      needleInTitle(n, index) ||
      (n.length >= MIN_SUBSTRING_LEN && (s.includes(n) || n.includes(s))),
  )
}
