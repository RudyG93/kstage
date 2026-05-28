'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import type { Database } from '@/types/database'

export type BannerResult = { error: string } | { ok: true; bannerUrl: string }

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Enregistre un bandeau recadré manuellement (admin only). */
export async function setGroupBanner(groupId: string, formData: FormData): Promise<BannerResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdmin(user.email)) return { error: 'Forbidden.' }

  const file = formData.get('banner')
  if (!(file instanceof File) || file.size === 0) return { error: 'No image provided.' }

  const admin = serviceClient()
  const path = `${groupId}.jpg`
  const { error: upErr } = await admin.storage
    .from('banners')
    .upload(path, file, { upsert: true, contentType: 'image/jpeg' })
  if (upErr) return { error: 'Could not upload the banner.' }

  const { data: pub } = admin.storage.from('banners').getPublicUrl(path)
  const bannerUrl = `${pub.publicUrl}?v=${Date.now()}`

  const { error } = await admin.from('groups').update({ banner_url: bannerUrl }).eq('id', groupId)
  if (error) return { error: 'Could not save the banner.' }

  revalidatePath('/', 'layout')
  revalidatePath('/admin/banners')
  return { ok: true, bannerUrl }
}

/** Efface l'override manuel pour qu'un groupe retombe sur le crop automatique. */
export async function resetGroupBanner(groupId: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdmin(user.email)) return { error: 'Forbidden.' }

  const admin = serviceClient()
  const { error } = await admin.from('groups').update({ banner_url: null }).eq('id', groupId)
  if (error) return { error: 'Could not reset the banner.' }

  revalidatePath('/', 'layout')
  revalidatePath('/admin/banners')
  return { ok: true }
}
