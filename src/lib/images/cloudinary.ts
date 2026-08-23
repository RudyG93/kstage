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
 * Recadre une image distante (ex. Deezer) via Cloudinary fetch, centré
 * automatiquement sur le sujet/visage (`g_auto`). `f_auto,q_auto` = format et
 * qualité optimisés par Cloudinary. Si le cloud name n'est pas configuré, on
 * renvoie l'URL d'origine (dégradation gracieuse).
 */
export function faceCrop(url: string, width: number, height: number): string {
  if (!CLOUD || !isRemote(url)) return url
  const t = `c_fill,g_auto,w_${width},h_${height},f_auto,q_auto`
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
