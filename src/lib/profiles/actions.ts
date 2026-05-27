'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalizeUsername } from './validation'

export type ProfileState = { error: string } | { ok: true } | null

const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

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
  const username = parsed.value

  let avatarUrl: string | undefined
  const file = formData.get('avatar')
  if (file instanceof File && file.size > 0) {
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
    avatarUrl = `${pub.publicUrl}?v=${Date.now()}`
  }

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    username,
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  })
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
