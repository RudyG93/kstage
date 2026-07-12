// Helpers Spotify Web API (client-credentials, server-only) pour les images
// d'artistes. R4-B (2026-07-13) : accès PAR ID uniquement, via links->>'spotify'
// seedé. La recherche par nom est SUPPRIMÉE : son repli aveugle `items[0]`
// écrivait n'importe quel homonyme (WEi → « Weird Al » Yankovic, vérifié en
// prod), et le cron hebdo re-corrompait toute réparation manuelle.

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')

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

/** Artiste par ID — jamais d'ambiguïté d'homonyme, images carrées canoniques. */
export async function spotifyArtistById(
  id: string,
  token: string,
): Promise<SpotifyArtistById | null> {
  const res = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const a = (await res.json()) as {
    name?: string
    images?: { url: string; width: number }[]
    followers?: { total: number }
  }
  if (!a?.name) return null
  return {
    name: a.name,
    image: (a.images ?? []).slice().sort((x, y) => y.width - x.width)[0]?.url ?? null,
    followers: a.followers?.total ?? null,
  }
}

// Noms Spotify officiels qui ne contiennent pas le nom DB (seul cas connu :
// TXT ↔ TOMORROW X TOGETHER). Clés/valeurs en forme normalisée.
const NAME_ALIASES: Record<string, string> = {
  txt: 'tomorrowxtogether',
}

/**
 * Garde de cohérence entre le nom en DB et le nom renvoyé par Spotify : un
 * lien mal seedé (TXT → artiste « T.X.T. ») ne doit JAMAIS écrire d'image.
 * Match: égalité normalisée, inclusion dans un sens ou l'autre, ou alias.
 */
export function spotifyNameMatches(groupName: string, artistName: string): boolean {
  const g = norm(groupName)
  const s = norm(artistName)
  if (!g || !s) return false
  if (g === s || g.includes(s) || s.includes(g)) return true
  return NAME_ALIASES[g] === s
}
