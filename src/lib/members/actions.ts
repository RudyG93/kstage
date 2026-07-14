'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { selfHostImage } from '@/lib/images/self-host'
import type { Database } from '@/types/database'

/**
 * Remplace la photo d'un membre par une image distante (self-hostée), admin only.
 * `photo_source_key='admin'` marque l'override manuel — le cron refresh-images le
 * respecte (ne l'écrase pas avec fandom). Sert l'éditeur /admin/images.
 */
export async function setMemberPhoto(
  memberId: string,
  url: string,
): Promise<{ error: string } | { ok: true; photoUrl: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return gate

  const clean = url.trim()
  if (!clean) return { error: 'No image URL provided.' }

  const hosted = await selfHostImage(clean, 'member-photos', memberId)
  if ('error' in hosted) return hosted

  const admin = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { error } = await admin
    .from('members')
    .update({
      photo_url: hosted.url,
      photo_source_key: 'admin',
      photo_checked_at: new Date().toISOString(),
    })
    .eq('id', memberId)
  if (error) return { error: 'Could not save the photo.' }

  revalidatePath('/', 'layout')
  revalidatePath('/admin/images')
  return { ok: true, photoUrl: hosted.url }
}
