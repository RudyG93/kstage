const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

/**
 * Cloudinary `fetch` va CHERCHER l'image sur le réseau : il ne peut rien faire
 * d'une `blob:` (mémoire du navigateur) ni d'une `data:`. L'aperçu optimiste
 * qui suit un recadrage d'avatar est justement une `blob:` — proxyée, elle
 * partait en `…/fetch/blob%3A…` et Cloudinary répondait 400, donc image
 * cassée jusqu'au rechargement de la page. Local = servi tel quel.
 */
const isRemote = (url: string): boolean => /^https?:\/\//i.test(url)

/**
 * L'URL est-elle servie par NOTRE bucket public Supabase ?
 *
 * Ancré sur l'origine, jamais sur une sous-chaîne : `avatar_url` est écrit par
 * l'utilisateur (la policy `profiles: update own` ne contrôle pas les
 * colonnes), et un `https://attaquant.example/storage/v1/object/...` passait le
 * test « l'URL contient /storage/v1/object/ ». Servie brute, elle faisait
 * récolter l'IP de chaque lecteur par l'attaquant. La base le refuse depuis la
 * migration 0072 ; ceci est la seconde barrière, et elle couvre aussi les
 * lignes écrites avant.
 */
export function isOwnStorageUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return false
  try {
    return new URL(url).origin === new URL(base).origin
  } catch {
    return false
  }
}

/**
 * L'image vient-elle du CDN Spotify ?
 *
 * Ancré sur le HOST, jamais sur une sous-chaîne : `image_url` est alimenté par
 * un scraper, et un `https://attaquant.example/?x=i.scdn.co` passerait un test
 * `includes()`. Même règle que `isOwnStorageUrl` ci-dessus, pour la même raison.
 */
export function isSpotifyImage(url: string): boolean {
  try {
    const h = new URL(url).host
    return h === 'i.scdn.co' || h.endsWith('.scdn.co')
  } catch {
    return false
  }
}

/**
 * Redimensionne une image distante via Cloudinary fetch. `f_auto,q_auto` =
 * format et qualité optimisés. Sans cloud name configuré, on renvoie l'URL
 * d'origine (dégradation gracieuse).
 *
 * DEUX TRANSFORMATIONS, selon l'origine :
 *
 * - **Spotify** → `c_fit` : redimensionnement SANS recadrage. Les Design
 *   Guidelines Spotify sont explicites — « Artwork must be kept in its original
 *   form », « Don't crop the artwork in any way » — alors que les Developer
 *   Terms IV.2.1(b) autorisent nommément l'inverse : « You may adjust the size
 *   of metadata or cover art as necessary ». On redimensionne donc, jamais on
 *   ne rogne. Sur une source carrée dans une boîte carrée — le cas de tous les
 *   avatars — `c_fit` et `c_fill` rendent la même image : le correctif ne coûte
 *   rien visuellement là où il ne change rien juridiquement.
 * - **tout le reste** (fandom, notre bucket, YouTube) → `c_fill,g_auto`,
 *   centré sur le sujet.
 */
export function faceCrop(url: string, width: number, height: number): string {
  if (!CLOUD || !isRemote(url)) return url
  const cadrage = isSpotifyImage(url) ? 'c_fit' : 'c_fill,g_auto'
  const t = `${cadrage},w_${width},h_${height},f_auto,q_auto`
  return `https://res.cloudinary.com/${CLOUD}/image/fetch/${t}/${encodeURIComponent(url)}`
}

/**
 * Proxy l'image entière (sans recadrage) via Cloudinary — sert à charger une
 * source distante avec CORS activé (Access-Control-Allow-Origin: *) pour
 * pouvoir l'exporter sur un canvas (cropper admin).
 */
export function cloudinaryProxy(url: string, width: number): string {
  if (!CLOUD || !isRemote(url)) return url
  return `https://res.cloudinary.com/${CLOUD}/image/fetch/w_${width},f_auto,q_auto/${encodeURIComponent(url)}`
}
