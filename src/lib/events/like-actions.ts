'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Like / unlike binaire d'un MV (table mv_like).
 *
 * Fix 2026-07-12 (« something went wrong » au like, retour Rudy) :
 * - l'action ne revalidait AUCUN chemin → le Router Cache resservait
 *   `initialLiked` périmé, et le toggle suivant ré-insérait un like existant
 *   → violation PK 23505 → throw → error boundary plein écran ;
 * - l'insert est désormais idempotent (23505 ignoré — l'état voulu est
 *   atteint), le delete l'était déjà, et `revalidatePath('/mv/{slug}')`
 *   resynchronise le cache (même pattern que rating-actions).
 */
export async function toggleLike(eventId: string, isLiked: boolean, slug: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (isLiked) {
    const { error } = await supabase
      .from('mv_like')
      .delete()
      .eq('user_id', user.id)
      .eq('event_id', eventId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('mv_like').insert({ user_id: user.id, event_id: eventId })
    if (error && error.code !== '23505') throw error
  }

  // Slug validé avant interpolation (jamais de chemin arbitraire).
  if (/^[a-z0-9-]+$/.test(slug)) revalidatePath(`/mv/${slug}`)
}
