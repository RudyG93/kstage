import { faceCrop } from '@/lib/images/cloudinary'

// Chaîne bannière UNIQUE pour toutes les surfaces (héros groupe/artiste,
// strip Drops) — R4-B : les surfaces divergeaient (le strip /mvs servait le
// carré Spotify brut, les héros un hqdefault YouTube 480px flou).
//   1. banner_url     — crop manuel admin (priorité absolue)
//   2. banner_yt_url  — bannière 2560px de la chaîne YT officielle, rafraîchie
//                       par les labels à chaque ère (cron refresh-images)
//   3. faceCrop(image_url) — carré Spotify recadré visages via Cloudinary

export interface BannerFields {
  banner_url: string | null
  banner_yt_url: string | null
  image_url: string | null
}

export function groupBannerSrc(
  group: BannerFields,
  opts: { width?: number; height?: number } = {},
): string | null {
  if (group.banner_url) return group.banner_url
  if (group.banner_yt_url) return group.banner_yt_url
  return group.image_url ? faceCrop(group.image_url, opts.width ?? 1600, opts.height ?? 500) : null
}
