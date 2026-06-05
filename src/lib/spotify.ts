// Helpers Spotify Web API (client-credentials, server-only) pour rafraîchir les
// images d'artistes (§10). Mêmes endpoints que scripts/roster/seed-artist-links.ts,
// version minimale réutilisable côté route cron.

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

/** Image d'artiste la plus grande pour `name` (match exact prioritaire), ou null. */
export async function spotifyArtistImage(name: string, token: string): Promise<string | null> {
  const res = await fetch(
    `https://api.spotify.com/v1/search?type=artist&limit=5&q=${encodeURIComponent(name)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) return null
  const items =
    (
      (await res.json()) as {
        artists?: { items?: { name: string; images?: { url: string; width: number }[] }[] }
      }
    ).artists?.items ?? []
  const exact = items.find((a) => a?.name && norm(a.name) === norm(name))
  const a = exact ?? items[0]
  return (a?.images ?? []).slice().sort((x, y) => y.width - x.width)[0]?.url ?? null
}
