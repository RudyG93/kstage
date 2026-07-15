'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalizeUsername } from './validation'
import { isValidTimeZone } from './timezone'

export type ProfileState = { error: string } | { ok: true } | null
export type AvatarResult = { error: string } | { ok: true; avatarUrl: string }

const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/** Chemin storage d'une URL d'avatar du bucket `avatars` si elle appartient au
 *  dossier de l'utilisateur, sinon null (URL externe/legacy). Sert au nettoyage
 *  de l'ancien fichier après un upload sur chemin unique. */
function ownAvatarPath(url: string | null, userId: string): string | null {
  if (!url) return null
  const i = url.indexOf('/avatars/')
  if (i === -1) return null
  const path = url.slice(i + '/avatars/'.length).split('?')[0]
  return path.startsWith(`${userId}/`) ? path : null
}

/** Définit (ou retire si null) le bias = membre favori du user. */
export async function setBias(memberId: string | null): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('profiles')
    .update({ bias_member_id: memberId })
    .eq('id', user.id)
  if (error) return { error: 'Could not save your bias.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Définit (ou retire si null) le groupe/artiste favori du user. */
export async function setFavoriteGroup(
  groupId: string | null,
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('profiles')
    .update({ favorite_group_id: groupId })
    .eq('id', user.id)
  if (error) return { error: 'Could not save your favorite.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Enregistre le username (la casse saisie est conservée ; unicité citext). */
export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = normalizeUsername(String(formData.get('username') ?? ''))
  if ('error' in parsed) return { error: parsed.error }

  // Fuseau IANA : validé, sinon ignoré (on ne l'écrase pas avec une valeur folle).
  const tzRaw = String(formData.get('timezone') ?? '')
  const timezone = isValidTimeZone(tzRaw) ? tzRaw : undefined

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, username: parsed.value, ...(timezone ? { timezone } : {}) })
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      return { error: 'That username is already taken.' }
    }
    return { error: 'Could not save your profile. Please try again.' }
  }

  revalidatePath('/account')
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Upload + persiste l'avatar immédiatement (découplé du username). */
export async function updateAvatar(formData: FormData): Promise<AvatarResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const file = formData.get('avatar')
  if (!(file instanceof File) || file.size === 0) return { error: 'No image provided.' }
  if (file.size > AVATAR_MAX_BYTES) return { error: 'Avatar must be 2 MB or smaller.' }
  const ext = AVATAR_EXT[file.type]
  if (!ext) return { error: 'Avatar must be a PNG, JPEG or WebP image.' }

  // Chemin UNIQUE par upload → INSERT simple (pas d'upsert). L'upsert exigeait
  // un SELECT sur le bucket pour retrouver l'objet existant ; or 0035 a retiré
  // cette policy SELECT → l'upsert tombait en collision unique (bug « changement
  // d'avatar »). Un chemin neuf ne dépend que de la policy INSERT « own folder ».
  // L'URL change à chaque fois → plus besoin du cache-bust `?v=`.
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`
  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type })
  if (uploadErr) return { error: 'Could not upload the avatar. Please try again.' }

  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
  const avatarUrl = pub.publicUrl

  // Ancien avatar (chemin unique → sinon accumulation d'orphelins).
  const { data: prev } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single()

  const { error } = await supabase.from('profiles').upsert({ id: user.id, avatar_url: avatarUrl })
  if (error) return { error: 'Could not save your avatar. Please try again.' }

  // Best-effort : retire l'ancien objet du bucket (ignore toute erreur).
  const oldPath = ownAvatarPath(prev?.avatar_url ?? null, user.id)
  if (oldPath) await supabase.storage.from('avatars').remove([oldPath])

  revalidatePath('/account')
  revalidatePath('/', 'layout')
  return { ok: true, avatarUrl }
}
