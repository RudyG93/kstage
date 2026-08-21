'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

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
    let timer: ReturnType<typeof setTimeout> | null = null
    let pendingWhileHidden = false
    let dispose: (() => void) | null = null
    let cancelled = false

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

    // Import DYNAMIQUE du client Supabase (perf 2026-08-22). En import statique,
    // ce fichier — seul consommateur client de `@/lib/supabase/browser` —
    // faisait entrer supabase-js AVEC Realtime, Phoenix et GoTrue dans le
    // bundle de CHAQUE route : 252 Ko bruts, le plus gros chunk du build,
    // téléchargés même sur les pages où le bloc discussions ne s'affiche pas.
    // Le rendre conditionnel ne suffisait pas : c'est l'import qui compte,
    // pas le rendu. Ici le chunk n'est demandé qu'à l'exécution de l'effet.
    void import('@/lib/supabase/browser').then(({ createClient }) => {
      if (cancelled) return
      const supabase = createClient()
      const channel = supabase
        .channel('recent-comments')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, () => {
          if (timer) clearTimeout(timer)
          timer = setTimeout(refresh, 1500)
        })
        .subscribe()
      dispose = () => supabase.removeChannel(channel)
    })

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      dispose?.()
    }
  }, [router])
  return null
}
