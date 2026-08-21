import { cloudinaryProxy, faceCrop } from '@/lib/images/cloudinary'

// Chaîne bannière UNIQUE pour toutes les surfaces (héros groupe/artiste,
// strip Drops) — R4-B : les surfaces divergeaient (le strip /mvs servait le
// carré Spotify brut, les héros un hqdefault YouTube 480px flou).
//   1. banner_url     — crop manuel admin (priorité absolue)
//   2. banner_yt_url  — bannière de la chaîne YT officielle, rafraîchie par les
//                       labels à chaque ère (cron refresh-images)
//   3. faceCrop(image_url) — carré Spotify recadré visages via Cloudinary
//
// PERF 2026-08-22 — les deux premières sources partaient BRUTES. Le cron écrit
// l'URL YouTube en `=w2560` : mesuré sur aespa, **1 220 921 octets** pour une
// boîte de 672 × 210 CSS, et c'est l'élément LCP de toutes les pages groupe et
// artiste. Le même visuel recadré par Cloudinary à la taille réellement
// affichée (1344 × 420, soit DPR 2) pèse **172 737 octets** — 86 % de moins.
// Elles passent donc par Cloudinary comme le faisait déjà le repli.

export interface BannerFields {
  banner_url: string | null
  banner_yt_url: string | null
  image_url: string | null
}

/** Boîte réelle du héros (`h-[210px]`, `sizes` 672 px) × DPR 2. */
const DEFAULT_WIDTH = 1344
const DEFAULT_HEIGHT = 420

export function groupBannerSrc(
  group: BannerFields,
  opts: { width?: number; height?: number } = {},
): string | null {
  const width = opts.width ?? DEFAULT_WIDTH
  const height = opts.height ?? DEFAULT_HEIGHT
  // Crop MANUEL de l'admin : son cadrage est délibéré, on se contente de le
  // redimensionner (jamais de `g_auto`, qui le re-cadrerait autrement).
  if (group.banner_url) return cloudinaryProxy(group.banner_url, width)
  // Bannière YouTube : ultra-large (2560 × 423) pour une boîte en 3,2:1 —
  // `c_fill,g_auto` choisit la zone d'intérêt au lieu de rogner au centre.
  if (group.banner_yt_url) return faceCrop(group.banner_yt_url, width, height)
  return group.image_url ? faceCrop(group.image_url, width, height) : null
}
