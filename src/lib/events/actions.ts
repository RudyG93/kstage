'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { Database } from '@/types/database'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Corrige le titre d'un event (admin only). `title` est NOT NULL — refus si vide. */
export async function updateEventTitle(
  eventId: string,
  title: string,
): Promise<{ error: string } | { ok: true }> {
  const gate = await requireAdmin()
  if ('error' in gate) return gate

  const clean = title.trim()
  if (!clean) return { error: 'Title cannot be empty.' }

  const { error } = await serviceClient().from('events').update({ title: clean }).eq('id', eventId)
  if (error) return { error: 'Could not update the title.' }

  revalidatePath('/', 'layout')
  revalidatePath('/admin/events')
  return { ok: true }
}

/**
 * Masque/ré-affiche un event (admin only) — un faux event mis-scrapé sans le
 * supprimer. `hidden` est filtré dans les requêtes display/search (queries.ts).
 */
export async function setEventHidden(
  eventId: string,
  hidden: boolean,
): Promise<{ error: string } | { ok: true }> {
  const gate = await requireAdmin()
  if ('error' in gate) return gate

  const { error } = await serviceClient().from('events').update({ hidden }).eq('id', eventId)
  if (error) return { error: 'Could not update visibility.' }

  revalidatePath('/', 'layout')
  revalidatePath('/admin/events')
  return { ok: true }
}
