'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parseRatingInput } from './rating-validation'

export type RatingState = { error: string } | { ok: true; score: number } | null

/**
 * Enregistre la note d'un user pour un MV (1-10). Upsert sur la contrainte
 * unique (event_id, user_id) : re-noter écrase la note précédente.
 *
 * Form fields attendus :
 *  - eventId  (UUID)
 *  - score    ("1".."10")
 *  - slug     (slug de l'event, pour `revalidatePath('/mv/{slug}')`)
 */
export async function rateEvent(_prev: RatingState, formData: FormData): Promise<RatingState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = parseRatingInput({
    eventId: String(formData.get('eventId') ?? ''),
    score: String(formData.get('score') ?? ''),
  })
  if ('error' in parsed) return { error: parsed.error }
  const { eventId, score } = parsed.value

  const { error } = await supabase.from('event_ratings').upsert(
    {
      event_id: eventId,
      user_id: user.id,
      score,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id,user_id' },
  )
  if (error) return { error: 'Could not save your rating. Please try again.' }

  // slug vient d'un input non fiable : on whitelist pour éviter de flush des
  // chemins de cache arbitraires via `revalidatePath`.
  const slug = String(formData.get('slug') ?? '').trim()
  if (/^[a-z0-9-]+$/.test(slug)) revalidatePath(`/mv/${slug}`)

  return { ok: true, score }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Supprime la note de l'user pour un MV (§1.1, bouton « supprimer ma note »). */
export async function deleteRating(
  eventId: string,
  slug: string,
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!UUID_RE.test(eventId)) return { error: 'Invalid event reference.' }

  const { error } = await supabase
    .from('event_ratings')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', user.id)
  if (error) return { error: 'Could not remove your rating.' }

  if (/^[a-z0-9-]+$/.test(slug)) revalidatePath(`/mv/${slug}`)
  return { ok: true }
}
