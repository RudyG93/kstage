/**
 * Loader `next/image` personnalisé — délégué à Cloudinary (perf 2026-08-22).
 *
 * Pourquoi un loader plutôt que l'optimiseur Vercel : le pipeline d'images du
 * projet passe DÉJÀ par Cloudinary (`faceCrop`, recadrage `g_auto` sur les
 * visages, `f_auto,q_auto`). Les composants posaient donc `unoptimized` pour ne
 * pas payer deux transformations — au prix du `srcset` : 212 des 231 `<img>`
 * servis en production n'en avaient aucun, et une tuile de 176,5 px de large
 * téléchargeait 600 px (44 Ko au lieu de 10).
 *
 * Le loader rend le `srcset` SANS ajouter de transformation : il réécrit la
 * largeur demandée dans l'URL Cloudinary que le composant a déjà construite,
 * en conservant le cadrage et le ratio d'origine.
 *
 * Une image sans `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, ou dont l'URL n'est pas
 * transformable, ressort inchangée : dégradation silencieuse, jamais d'erreur.
 * Les composants qui gardent `unoptimized` ne passent pas ici du tout.
 */

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

/** `/image/fetch/<transformations>/<url encodée>` */
const FETCH_RE = /\/image\/fetch\/([^/]+)\/(.+)$/

export default function cloudinaryLoader({ src, width }: { src: string; width: number }): string {
  if (!src) return src

  // 1. URL Cloudinary déjà transformée : on ne remplace QUE la largeur (et la
  //    hauteur au même ratio), pour ne pas perdre `c_fill,g_auto` ni le format.
  const fetched = FETCH_RE.exec(src)
  if (fetched) {
    const [, transforms] = fetched
    const w = /(?:^|,)w_(\d+)(?:,|$)/.exec(transforms)
    if (!w) return src
    const h = /(?:^|,)h_(\d+)(?:,|$)/.exec(transforms)
    const ratio = h ? Number(h[1]) / Number(w[1]) : null
    let next = transforms.replace(/(^|,)w_\d+/, `$1w_${width}`)
    if (ratio) next = next.replace(/(^|,)h_\d+/, `$1h_${Math.round(width * ratio)}`)
    return src.replace(`/image/fetch/${transforms}/`, `/image/fetch/${next}/`)
  }

  // 2. Source distante brute (pochette Spotify, miniature YouTube, Storage) :
  //    Cloudinary la sert au format négocié et à la largeur demandée. Pas de
  //    recadrage — le composant n'en a pas demandé.
  if (!CLOUD) return src
  return `https://res.cloudinary.com/${CLOUD}/image/fetch/w_${width},f_auto,q_auto/${encodeURIComponent(src)}`
}
