'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalizeUsername } from './validation'

export type ProfileState = { error: string } | { ok: true } | null
export type AvatarResult = { error: string } | { ok: true; avatarUrl: string }

const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
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

  const { error } = await supabase.from('profiles').upsert({ id: user.id, username: parsed.value })
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

  const path = `${user.id}/avatar.${ext}`
  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadErr) return { error: 'Could not upload the avatar. Please try again.' }

  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
  // cache-bust : force le navigateur à recharger l'avatar après remplacement
  const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`

  const { error } = await supabase.from('profiles').upsert({ id: user.id, avatar_url: avatarUrl })
  if (error) return { error: 'Could not save your avatar. Please try again.' }

  revalidatePath('/account')
  revalidatePath('/', 'layout')
  return { ok: true, avatarUrl }
}
