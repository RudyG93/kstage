'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

/**
 * Abonnement Supabase Realtime sur les INSERT de `comments` (§7.2). À chaque
 * nouveau commentaire, on déclenche un router.refresh() (re-render du Server
 * Component) pour remonter l'entité en tête de "Recent discussions" sans reload.
 * Débounce 1.5s pour regrouper les rafales. Canal nettoyé au démontage.
 */
export function CommentsRealtime() {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const channel = supabase
      .channel('recent-comments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => router.refresh(), 1500)
      })
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [router])
  return null
}
