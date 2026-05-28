// Extrait l'ID vidéo YouTube (11 caractères) depuis une URL.
// Supporte watch?v=, youtu.be/, embed/. Renvoie null si non-YouTube ou malformé.
const YOUTUBE_ID_RE =
  /(?:youtube\.com\/watch\?(?:[^&]*&)*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/

export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null
  const m = YOUTUBE_ID_RE.exec(url)
  return m ? m[1] : null
}
