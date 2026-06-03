export const MAX_ARTIST_NAME = 80
export const MAX_MEMBERS = 30

export interface ArtistMember {
  name: string
  position: string | null
}

export interface ArtistSuggestionInput {
  name: string
  kind: 'group' | 'solo'
  agency: string | null
  debutDate: string | null // YYYY-MM-DD
  fandomName: string | null
  colorHex: string | null
  imageUrl: string | null
  members: ArtistMember[]
  sourceUrl: string | null
}

export interface RawArtistSuggestion {
  name?: string
  kind?: string
  agency?: string
  debutDate?: string
  fandomName?: string
  colorHex?: string
  imageUrl?: string
  members?: string // JSON string [{ name, position }]
  sourceUrl?: string
}

function optionalText(raw: string | undefined, max = 120): string | null {
  const t = (raw ?? '').trim()
  return t ? t.slice(0, max) : null
}

function optionalUrl(raw: string | undefined): { error: string } | { value: string | null } {
  const t = (raw ?? '').trim()
  if (!t) return { value: null }
  if (!/^https?:\/\/.+/i.test(t)) return { error: 'URLs must start with http:// or https://.' }
  return { value: t }
}

function parseMembers(raw: string | undefined): ArtistMember[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const out: ArtistMember[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue
    const name = String((entry as { name?: unknown }).name ?? '').trim()
    if (!name) continue
    const position = String((entry as { position?: unknown }).position ?? '').trim()
    out.push({ name: name.slice(0, 80), position: position ? position.slice(0, 80) : null })
    if (out.length >= MAX_MEMBERS) break
  }
  return out
}

/** Valide une suggestion d'artiste (saisie user non fiable). */
export function parseArtistSuggestionInput(
  raw: RawArtistSuggestion,
): { error: string } | { value: ArtistSuggestionInput } {
  const name = (raw.name ?? '').trim()
  if (!name) return { error: 'Name is required.' }
  if (name.length > MAX_ARTIST_NAME) {
    return { error: `Name must be ${MAX_ARTIST_NAME} characters or fewer.` }
  }

  const kind = (raw.kind ?? '').trim()
  if (kind !== 'group' && kind !== 'solo') return { error: 'Please choose group or solo.' }

  const colorRaw = (raw.colorHex ?? '').trim()
  let colorHex: string | null = null
  if (colorRaw) {
    if (!/^#[0-9a-f]{6}$/i.test(colorRaw))
      return { error: 'Color must be a hex code like #1abc9c.' }
    colorHex = colorRaw.toLowerCase()
  }

  const debutRaw = (raw.debutDate ?? '').trim()
  let debutDate: string | null = null
  if (debutRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(debutRaw)) return { error: 'Debut date must be YYYY-MM-DD.' }
    debutDate = debutRaw
  }

  const imageUrl = optionalUrl(raw.imageUrl)
  if ('error' in imageUrl) return { error: imageUrl.error }
  const sourceUrl = optionalUrl(raw.sourceUrl)
  if ('error' in sourceUrl) return { error: sourceUrl.error }

  return {
    value: {
      name,
      kind,
      agency: optionalText(raw.agency),
      debutDate,
      fandomName: optionalText(raw.fandomName),
      colorHex,
      imageUrl: imageUrl.value,
      members: kind === 'group' ? parseMembers(raw.members) : [],
      sourceUrl: sourceUrl.value,
    },
  }
}
