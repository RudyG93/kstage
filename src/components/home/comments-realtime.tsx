'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

/**
 * Abonnement Supabase Realtime sur les INSERT de `comments` (§7.2). À chaque
 * nouveau commentaire, on déclenche un router.refresh() (re-render du Server
 * Component) pour remonter l'entité en tête de "Recent discussions" sans reload.
 * Débounce 1.5s pour regrouper les rafales. Canal nettoyé au démontage.
 *
 * Onglet caché (Lot A perf 2026-07-18) : un refresh re-exécute TOUTES les
 * queries serveur de la route — déclenché par les commentaires des AUTRES,
 * il tournait sur des onglets laissés ouverts. On le diffère jusqu'au retour
 * de visibilité (le vrai fix — ne re-render que le trou dynamique — viendra
 * avec cacheComponents, Lot I).
 */
export function CommentsRealtime() {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    let pendingWhileHidden = false
    const refresh = () => {
      if (document.visibilityState !== 'visible') {
        pendingWhileHidden = true
        return
      }
      router.refresh()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && pendingWhileHidden) {
        pendingWhileHidden = false
        router.refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    const channel = supabase
      .channel('recent-comments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(refresh, 1500)
      })
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [router])
  return null
}
